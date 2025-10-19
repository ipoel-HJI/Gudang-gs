/* Aplikasi Gudang — penyimpanan menggunakan localStorage
   LocalStorage keys:
   - wg_categories (array string)
   - wg_items (array {id,category,name,stock})
   - wg_incoming (array report)
   - wg_outgoing (array report)
   - wg_requests (array request)
   - wg_pending (array pending requests from users)
*/

// --- Utilities ---
const LS = {
  get(k, fallback){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch(e){return fallback}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))},
  clear(){localStorage.clear()}
}

const DEFAULT = (function(){
  return {
    categories:["Konsumsi","Alat Kebersihan","Perlengkapan Mess","ATK"],
    items:[
      {id:1,category:"Konsumsi",name:"Air Mineral 600ml",stock:120},
      {id:2,category:"Konsumsi",name:"Indomie",stock:60},
      {id:3,category:"Alat Kebersihan",name:"Sapu",stock:30},
      {id:4,category:"Perlengkapan Mess",name:"Guling",stock:12},
      {id:5,category:"ATK",name:"Pulpen",stock:200}
    ],
    incoming:[],outgoing:[],requests:[],pending:[]
  }
})();

function initIfEmpty(){
  if(!localStorage.getItem('wg_categories')){
    LS.set('wg_categories', DEFAULT.categories);
    LS.set('wg_items', DEFAULT.items);
    LS.set('wg_incoming', DEFAULT.incoming);
    LS.set('wg_outgoing', DEFAULT.outgoing);
    LS.set('wg_requests', DEFAULT.requests);
    LS.set('wg_pending', DEFAULT.pending);
  }
}

initIfEmpty();

// --- Simple DOM helpers ---
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// --- Routing of views ---
const content = $('#content');
const roleSelect = $('#roleSelect');
let role = 'user';
updateMenuVisibility();

const adminLoginModal = document.getElementById('adminLoginModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');

// Ganti username & password sesuai kebutuhan
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "12345"
};

roleSelect.addEventListener('change', e=>{
  const selected = e.target.value;
  if(selected === 'admin'){
    adminLoginModal.style.display = 'flex';
    roleSelect.value = 'user';
  } else {
    role = 'user';
    renderView(currentView);
  }
});

	function updateMenuVisibility() {
	const adminMenus = document.querySelectorAll('.admin-only');
	adminMenus.forEach(btn => {
    btn.style.display = (role === 'admin') ? 'block' : 'none';
	});
	}
// Login form submit
adminLoginForm.addEventListener('submit', e=>{
  e.preventDefault();
  const user = document.getElementById('adminUsername').value.trim();
  const pass = document.getElementById('adminPassword').value.trim();
  
  if(user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password){
    role = 'admin';
    roleSelect.value = 'admin';
    adminLoginModal.style.display = 'none';
    adminLoginForm.reset();
    updateMenuVisibility();
    renderView(currentView);
    alert('Login Admin berhasil ✅');
  } else {
    alert('Username atau Password salah ❌');
    roleSelect.value = 'user';
    adminLoginModal.style.display = 'none';
    adminLoginForm.reset();
    role = 'user';
    updateMenuVisibility();
    renderView(currentView);
  }
});


// Tombol batal login
cancelLoginBtn.addEventListener('click', ()=>{
  adminLoginModal.style.display = 'none';
  roleSelect.value = 'user';
});


let currentView = 'inventory';
$$('button[data-view]').forEach(btn=>btn.addEventListener('click', e=>{
  $$('button[data-view]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentView = btn.dataset.view; renderView(currentView);
}));

$('#resetBtn').addEventListener('click', ()=>{
  if(confirm('Reset semua data ke awal sample?')){
    LS.set('wg_categories', DEFAULT.categories);
    LS.set('wg_items', DEFAULT.items);
    LS.set('wg_incoming', DEFAULT.incoming);
    LS.set('wg_outgoing', DEFAULT.outgoing);
    LS.set('wg_requests', DEFAULT.requests);
    LS.set('wg_pending', DEFAULT.pending);
    alert('Data di-reset.');
    renderView(currentView);
  }
});

function renderView(view){
  content.innerHTML = '';

  // Batasi akses laporan hanya untuk Admin
  if((view === 'incoming' || view === 'outgoing') && role !== 'admin'){
    content.innerHTML = `
      <div class="view">
        <p style="text-align:center; margin-top:20px;">
          ❌ Hanya Admin yang dapat mengakses halaman ini.
        </p>
      </div>
    `;
    return;
  }

  if(view==='inventory') renderInventory();
  if(view==='take') renderTake();
  if(view==='request') renderRequest();
  if(view==='incoming') renderIncoming();
  if(view==='outgoing') renderOutgoing();
  if(view==='adminPanel') renderAdmin();
}


// --- Barang ---
function renderInventory(){
  const tpl = $('#tpl-inventory').content.cloneNode(true);
  const categoriesEl = tpl.getElementById('categoriesList');
  const cats = LS.get('wg_categories',[]);
  const items = LS.get('wg_items',[]);
  const search = tpl.getElementById('searchItem');

  function draw(filter=''){
    categoriesEl.innerHTML='';
    cats.forEach(cat=>{
      const box = document.createElement('div'); box.className='card';
      const h = document.createElement('h4'); h.textContent=cat; box.appendChild(h);
      const list = document.createElement('div');
      items.filter(i=>i.category===cat && i.name.toLowerCase().includes(filter.toLowerCase())).forEach(it=>{
        const row = document.createElement('div'); row.className='item-row';
        row.innerHTML = `<div><strong>${it.name}</strong><div class="muted">Stok: ${it.stock}</div></div>`;
        list.appendChild(row);
      });
      box.appendChild(list);
      categoriesEl.appendChild(box);
    });
  }
  search.addEventListener('input', e=>draw(e.target.value));
  draw();
  content.appendChild(tpl);
}

// --- (User) ---
function renderTake(){
  const tpl = $('#tpl-take').content.cloneNode(true);
  const form = tpl.getElementById('formTake');
  const catSel = tpl.getElementById('takeCategory');
  const itemSel = tpl.getElementById('takeItem');
  const pendingList = tpl.getElementById('pendingList');

  function populateCats(){
    const cats = LS.get('wg_categories',[]);
    catSel.innerHTML = '';
    cats.forEach(c=>{catSel.appendChild(new Option(c,c));});
    populateItems();
  }
  function populateItems(){
    const items = LS.get('wg_items',[]).filter(i=>i.category===catSel.value);
    itemSel.innerHTML = '';
    items.forEach(it=>itemSel.appendChild(new Option(`${it.name} (stok ${it.stock})`,it.name)));
  }

  catSel.addEventListener('change', populateItems);

  function drawPending(){
    const p = LS.get('wg_pending',[]);
    pendingList.innerHTML='';
    p.forEach((r,idx)=>{
      const d = document.createElement('div'); d.className='card';
      d.innerHTML = `<div><strong>${r.name}</strong> — ${r.instansi}<div class="muted">${r.date} • ${r.category} • ${r.itemName} x ${r.qty}</div></div>`;
      if(role==='admin'){
        const btns = document.createElement('div'); btns.style.marginTop='8px';
        const approve = document.createElement('button'); approve.textContent='Setujui'; approve.addEventListener('click',()=>approvePending(idx));
        const reject = document.createElement('button'); reject.textContent='Tolak'; reject.style.marginLeft='8px'; reject.addEventListener('click',()=>{ if(confirm('Tolak permohonan?')){ p.splice(idx,1); LS.set('wg_pending',p); drawPending(); } });
        btns.appendChild(approve); btns.appendChild(reject); d.appendChild(btns);
      }
      pendingList.appendChild(d);
    });
  }

  form.addEventListener('submit', e=>{
    e.preventDefault(); const fd = new FormData(form);
    let instansi = fd.get('instansi'); if(instansi==='Instansi Lainnya'){instansi = fd.get('instansi_manual') || instansi}
    const rec = {date:fd.get('date'), name:fd.get('name'), instansi, category:fd.get('category'), itemName:fd.get('itemName'), qty: parseInt(fd.get('qty'),10)};
    const p = LS.get('wg_pending',[]); p.push(rec); LS.set('wg_pending',p); 
	form.reset(); populateCats(); drawPending(); alert('Permohonan dikirim. Menunggu konfirmasi admin.');
  });

  function approvePending(index){
    const p = LS.get('wg_pending',[]);
    const record = p.splice(index,1)[0];
    const items = LS.get('wg_items',[]);
    const it = items.find(i=>i.name===record.itemName && i.category===record.category);
    if(!it || it.stock < record.qty){
      alert('Stok tidak cukup atau barang tidak ada. Mohon tangani dulu (tambah barang atau ubah stok).');
      LS.set('wg_pending',p);
      drawPending();
      return;
    }
    it.stock -= record.qty;
    LS.set('wg_items', items);
    const out = LS.get('wg_outgoing',[]);
    out.push({date:record.date, name:record.name, instansi:record.instansi, category:record.category, itemName:record.itemName, qty:record.qty});
    LS.set('wg_outgoing', out);
    LS.set('wg_pending', p);
    drawPending(); renderView('inventory'); alert('Permohonan disetujui dan tercatat di laporan pengambilan.');
  }

  populateCats(); drawPending(); content.appendChild(tpl);
}

// --- Request ---
function renderRequest(){
  const tpl = $('#tpl-request').content.cloneNode(true);
  const form = tpl.getElementById('formRequest');
  const reqCat = tpl.getElementById('reqCategory');
  const requestList = tpl.getElementById('requestList');
  function populateCats(){ const cats = LS.get('wg_categories',[]); reqCat.innerHTML=''; cats.forEach(c=>reqCat.appendChild(new Option(c,c))); }
  form.addEventListener('submit', e=>{
    e.preventDefault(); const fd=new FormData(form); const rec={instansi:fd.get('instansi'), category:fd.get('category'), itemName:fd.get('itemName'), qty:parseInt(fd.get('qty'),10), neededDate:fd.get('neededDate')||null, urgent:!!fd.get('urgent'), createdAt: new Date().toISOString()};
    const reqs = LS.get('wg_requests',[]); reqs.push(rec); LS.set('wg_requests', reqs); form.reset(); draw(); alert('Request terkirim ke admin.');
  });
  function draw(){ requestList.innerHTML=''; LS.get('wg_requests',[]).forEach((r)=>{
	  const d=document.createElement('div'); d.className='card'; 
	  d.innerHTML=`<div><strong>${r.itemName}</strong> — ${r.instansi}<div class="muted">${r.qty} • ${r.category} • perlu: ${r.neededDate||'-'} • urgent: ${r.urgent?'Ya':'Tidak'}</div></div>`; 
	  requestList.appendChild(d);}); }
  populateCats(); draw(); content.appendChild(tpl);
}

// --- barang masuk ---
function renderIncoming(){
  const tpl = $('#tpl-incoming').content.cloneNode(true);
  const form = tpl.getElementById('formIncoming');
  const incCategory = tpl.getElementById('incCategory');
  const incomingList = tpl.getElementById('incomingList');

  function populateCats(){ 
    const cats = LS.get('wg_categories',[]); 
    incCategory.innerHTML=''; 
    cats.forEach(c=>incCategory.appendChild(new Option(c,c))); 
  }

  form.addEventListener('submit', e=>{
    e.preventDefault(); 
    const fd=new FormData(form); 
    const rec={
      date:fd.get('date'), 
      category:fd.get('category'), 
      itemName:fd.get('itemName'), 
      qty:parseInt(fd.get('qty'),10)
    };
    const items = LS.get('wg_items',[]);
    let it = items.find(i=>i.name===rec.itemName && i.category===rec.category);
    if(it){ 
      it.stock += rec.qty; 
    } else { 
      it = {id: Date.now(), category: rec.category, name: rec.itemName, stock: rec.qty}; 
      items.push(it); 
    }
    LS.set('wg_items', items);
    const inc = LS.get('wg_incoming',[]); 
    inc.push(rec); 
    LS.set('wg_incoming', inc);
    form.reset(); 
    draw(); 
    renderView('inventory'); 
    alert('Barang masuk dicatat.');
  });

  function draw(){
    const data = LS.get('wg_incoming',[]);
    incomingList.innerHTML = '';

    if(data.length === 0){
      incomingList.innerHTML = '<p>Belum ada laporan barang masuk.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'report-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tanggal Barang Masuk</th>
          <th>Kategori Barang</th>
          <th>Nama Barang</th>
          <th>Jumlah Barang Masuk</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    data.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${r.category}</td>
        <td>${r.itemName}</td>
        <td>${r.qty}</td>
      `;
      tbody.appendChild(tr);
    });

    incomingList.appendChild(table);
  }

	populateCats(); 
	draw(); 
	const exportBtn = tpl.getElementById('exportIncomingBtn');
	exportBtn.addEventListener('click', ()=>{
	const data = LS.get('wg_incoming',[]);
	if(data.length === 0){ 
		alert('Tidak ada data untuk diekspor.');
    return;
	}

	const headers = ["date", "category", "itemName", "qty"];
	exportToExcel("Laporan_Barang_Masuk", headers, data);
	});
	const printBtn = tpl.getElementById('printIncomingBtn');
	printBtn.addEventListener('click', () => {
	printReport('incomingList', 'Laporan Barang Masuk');
	});


  content.appendChild(tpl);
}


// --- barang yang di ambil ---
function renderOutgoing(){
	
  const tpl = $('#tpl-outgoing').content.cloneNode(true);
  const outList = tpl.getElementById('outgoingList');
  const data = LS.get('wg_outgoing',[]);
  
	const exportBtn = tpl.getElementById('exportOutgoingBtn');
	exportBtn.addEventListener('click', ()=>{
	const data = LS.get('wg_outgoing',[]);
	if(data.length === 0){
    alert('Tidak ada data untuk diekspor.');
    return;
	}

	const headers = ["date", "instansi", "name", "category", "itemName", "qty"];
	exportToExcel("Laporan_Pengambilan", headers, data);
	});
	const printBtn = tpl.getElementById('printOutgoingBtn');
	printBtn.addEventListener('click', () => {
	printReport('outgoingList', 'Laporan Pengambilan');
	});


  if(data.length === 0){
    outList.innerHTML = '<p>Belum ada laporan pengambilan.</p>';
  } else {
    const table = document.createElement('table');
    table.className = 'report-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Instansi</th>
          <th>Nama</th>
          <th>Kategori Barang</th>
          <th>Nama Barang</th>
          <th>Jumlah</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    data.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${r.instansi}</td>
        <td>${r.name}</td>
        <td>${r.category}</td>
        <td>${r.itemName}</td>
        <td>${r.qty}</td>
      `;
      tbody.appendChild(tr);
    });

    outList.innerHTML = '';
    outList.appendChild(table);
  }
  content.appendChild(tpl);
}

// --- Admin panel ---
function renderAdmin(){
  if(role!=='admin'){ content.innerHTML = '<div class="view"><p>Hanya Admin yang dapat mengakses panel ini. Ubah role di atas.</p></div>'; return; }
  const tpl = $('#tpl-admin').content.cloneNode(true);
  const formCat = tpl.getElementById('formCategory');
  const catList = tpl.getElementById('catList');
  const formItem = tpl.getElementById('formItem');
  const itemCategory = tpl.getElementById('itemCategory');
  const itemList = tpl.getElementById('itemList');
  const adminRequests = tpl.getElementById('adminRequests');

  function populateCats(){ 
  const cats=LS.get('wg_categories',[]); catList.innerHTML=''; itemCategory.innerHTML=''; cats.forEach((c,idx)=>{ 
  const li=document.createElement('li'); li.textContent=c; 
  const del=document.createElement('button'); del.textContent='Hapus'; del.style.marginLeft='8px'; del.addEventListener('click',()=>{ 
  if(confirm('Hapus kategori dan semua barangnya?')){ 
  const items=LS.get('wg_items',[]).filter(i=>i.category!==c); LS.set('wg_items',items); cats.splice(idx,1); LS.set('wg_categories',cats); populateCats(); renderView('inventory'); } });
  li.appendChild(del); catList.appendChild(li); itemCategory.appendChild(new Option(c,c)); }); }
  formCat.addEventListener('submit', e=>{ e.preventDefault(); 
  const name = new FormData(formCat).get('catName'); 
  const cats = LS.get('wg_categories',[]); 
  if(!cats.includes(name)){ cats.push(name); LS.set('wg_categories',cats); populateCats(); formCat.reset(); } 
  else alert('Kategori sudah ada'); });

function populateItems(){
  itemList.innerHTML = ''; 

  const items = LS.get('wg_items',[]);
  const categories = LS.get('wg_categories',[]);

  // Loop per kategori
 categories.forEach(cat => {
  // Wrapper kategori
  const catSection = document.createElement('div');
  catSection.className = 'category-section';

  // Header kategori
  const catHeader = document.createElement('div');
  catHeader.className = 'category-header';
  catHeader.innerHTML = `<span class="category-name">${cat}</span><span class="toggle-btn">[−]</span>`;

  // Container isi item
  const catContent = document.createElement('div');
  catContent.className = 'category-content';

  // Tambahkan event klik untuk show/hide
  catHeader.addEventListener('click', () => {
    const isHidden = catContent.classList.toggle('hidden');
    catHeader.querySelector('.toggle-btn').textContent = isHidden ? '[+]' : '[−]';
  });

  // Isi daftar barang per kategori
  const catItems = items.filter(i => i.category === cat);

  if(catItems.length === 0){
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Tidak ada barang dalam kategori ini';
    catContent.appendChild(empty);
  } else {
    catItems.forEach(it => {
      const li = document.createElement('li'); 
      li.className = 'item-row'; 
      li.innerHTML = `
        <div class="item-info">
          <strong>${it.name}</strong>
          <div class='muted'>stok: ${it.stock}</div>
        </div>
        <div class="item-actions"></div>
      `;

      const edit = document.createElement('button'); 
      edit.textContent = 'Edit'; 
      edit.addEventListener('click', () => { 
        formItem.elements['category'].value = it.category; 
        formItem.elements['name'].value = it.name; 
        formItem.elements['stock'].value = it.stock; 
      });

      const del = document.createElement('button'); 
      del.textContent = 'Hapus'; 
      del.addEventListener('click', () => { 
        if(confirm('Hapus barang?')){ 
          const allItems = LS.get('wg_items',[]);
          const index = allItems.findIndex(x => x.id === it.id);
          if(index > -1){
            allItems.splice(index, 1);
            LS.set('wg_items', allItems);
            populateItems();
            renderView('inventory');
          }
        } 
      });

      const actionsContainer = li.querySelector('.item-actions');
      actionsContainer.appendChild(edit);
      actionsContainer.appendChild(del);

      catContent.appendChild(li);
    });
  }

  catSection.appendChild(catHeader);
  catSection.appendChild(catContent);
  catContent.classList.add('hidden');
  catHeader.querySelector('.toggle-btn').textContent = '[+]';

  itemList.appendChild(catSection);
});

}

		
		
		formItem.addEventListener('submit', e=>{ e.preventDefault(); 
		const fd=new FormData(formItem); 
		const cat=fd.get('category'), name=fd.get('name'), stock=parseInt(fd.get('stock'),10); 
		const items=LS.get('wg_items',[]); let it = items.find(i=>i.name===name && i.category===cat); 
		if(it){ it.stock = stock; } 
		else { items.push({id:Date.now(), category:cat, name, stock}); } 
		LS.set('wg_items',items); formItem.reset(); populateItems(); renderView('inventory'); });

  function drawAdminRequests(){ adminRequests.innerHTML=''; const pend = LS.get('wg_pending',[]); const reqs = LS.get('wg_requests',[]);
		const wrap = document.createElement('div'); wrap.innerHTML='<h4> Pengambilan Barang </h4>';
		pend.forEach((p,idx)=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=`<div><strong>${p.itemName}</strong><div class='muted'>${p.qty} • ${p.category} • ${p.date} • ${p.name} • ${p.instansi}</div></div>`; const ok=document.createElement('button'); ok.textContent='Setujui'; ok.addEventListener('click',()=>{ 
        const items = LS.get('wg_items',[]); const it = items.find(i=>i.name===p.itemName && i.category===p.category);
        if(!it || it.stock < p.qty){ alert('Stok tidak cukup. request barang untuk ketersediaan stok!.'); return; }
        it.stock -= p.qty; LS.set('wg_items',items);
        const out = LS.get('wg_outgoing',[]); out.push({date:p.date,name:p.name,instansi:p.instansi,category:p.category,itemName:p.itemName,qty:p.qty}); LS.set('wg_outgoing',out);
        const pend2 = LS.get('wg_pending',[]); pend2.splice(idx,1); LS.set('wg_pending',pend2); drawAdminRequests(); populateItems(); renderView('inventory'); alert('Dikonfirmasi'); });
        const rej=document.createElement('button'); rej.textContent='Tolak'; rej.style.marginLeft='8px'; rej.addEventListener('click',()=>{ if(confirm('Tolak permohonan?')){ const pend2=LS.get('wg_pending',[]); pend2.splice(idx,1); LS.set('wg_pending',pend2); drawAdminRequests(); } }); d.appendChild(ok); d.appendChild(rej); wrap.appendChild(d); });
		const wrap2 = document.createElement('div'); wrap2.innerHTML='<h4>Request Barang</h4>';
		reqs.forEach((r,idx)=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=`<div><strong>${r.itemName}</strong><div class='muted'>${r.qty} • ${r.category} • ${r.instansi} • needed: ${r.neededDate||'-'} • urgent: ${r.urgent? 'Ya':'Tidak'}</div></div>`;
		const mark=document.createElement('button'); mark.textContent='Tandai Tersedia (Tambahkan stok)'; 
		mark.addEventListener('click',()=>{
			const items = LS.get('wg_items',[]); let it = items.find(i=>i.name===r.itemName && i.category===r.category);
        if(!it){ it={id:Date.now(), category:r.category, name:r.itemName, stock:r.qty}; items.push(it);} 
		else { it.stock += r.qty; }
        LS.set('wg_items',items);
        const reqs2 = LS.get('wg_requests',[]); reqs2.splice(idx,1); LS.set('wg_requests',reqs2); 
		drawAdminRequests(); renderView('inventory'); alert('Request ditandai tersedia dan stok ditambah.');
		}); d.appendChild(mark); wrap2.appendChild(d); });
		adminRequests.appendChild(wrap); adminRequests.appendChild(wrap2);
  }

  populateCats(); populateItems(); drawAdminRequests(); content.appendChild(tpl);
}

// inisial untuk me-render
renderView(currentView);
// ==========================
//  Export ke Excel
// ==========================
function exportToExcel(filename, headers, data) {
  let csv = headers.join(",") + "\n";
  data.forEach(row => {
    csv += headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv"; // Excel bisa buka CSV langsung
  a.click();
  URL.revokeObjectURL(url);
}
// ==========================
// Cetak PDF
// ==========================
function printReport(containerId, title) {
  const container = document.getElementById(containerId);
  if (!container) {
    alert('Laporan tidak ditemukan.');
    return;
  }

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
    <head>
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #000;
        }
        h1 {
          text-align: center;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          border: 1px solid #333;
          padding: 8px;
          font-size: 0.9rem;
          text-align: left;
        }
        th {
          background: #f1f1f1;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${container.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}


// expose debug 
window._WG = {LS, DEFAULT};
window.addEventListener('load', ()=>{
  roleSelect.value = 'user';
  role = 'user';
  adminLoginModal.style.display = 'none';
  updateMenuVisibility();
  renderView('inventory'); // halaman awal
});

