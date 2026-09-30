const state={merchant:null,products:[],cart:{},category:'Tutti',query:''};
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function boot(){
  const [merchant,products]=await Promise.all([
    fetch('data/merchant.json').then(r=>r.json()),
    fetch('data/products.json').then(r=>r.json())
  ]);

  state.merchant=merchant;
  state.products=products.filter(p=>p.active);

  $('#merchantName').textContent=merchant.name;
  $('#tagline').textContent=merchant.tagline;
  $('#catalogMeta').textContent=`${state.products.length} referenze demo · listino storico ${merchant.source.catalog_published.split('-').reverse().join('/')}`;

  const cats=['Tutti',...new Set(state.products.map(p=>p.category))];
  $('#categories').innerHTML=cats.map(c=>`<button class="chip ${c==='Tutti'?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');

  $('#categories').addEventListener('click',e=>{
    if(!e.target.matches('.chip'))return;
    state.category=e.target.dataset.cat;
    document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===e.target));
    renderProducts();
  });

  $('#search').addEventListener('input',e=>{
    state.query=e.target.value.toLowerCase().trim();
    renderProducts();
  });

  $('#openCart').onclick=()=>$('#cart').classList.remove('hidden');
  $('#closeCart').onclick=()=>$('#cart').classList.add('hidden');
  $('#checkout').onclick=prepareWhatsApp;
  $('#reorderBtn').onclick=reorderLast;

  ['floor','elevator','dropoff'].forEach(id=>$('#'+id).addEventListener('change',updateAccessWarning));

  renderProducts();
  renderCart();
  restoreLast();
  updateAccessWarning();

  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function visibleProducts(){
  return state.products.filter(p=>
    (state.category==='Tutti'||p.category===state.category) &&
    (!state.query||`${p.brand} ${p.name} ${p.format} ${p.category}`.toLowerCase().includes(state.query))
  );
}

function renderProducts(){
  const host=$('#products');
  host.innerHTML='';

  visibleProducts().forEach(p=>{
    const n=$('#productTpl').content.cloneNode(true);
    n.querySelector('.category').textContent=p.category;
    n.querySelector('h3').textContent=p.name;
    n.querySelector('.format').textContent=p.format;
    n.querySelector('.price').textContent=euro(p.price);
    n.querySelector('.add').onclick=()=>add(p.id);
    host.appendChild(n);
  });

  if(!host.children.length)host.innerHTML='<p class="muted">Nessun prodotto trovato.</p>';
}

function add(id){
  state.cart[id]=(state.cart[id]||0)+1;
  renderCart();
}

function change(id,delta){
  state.cart[id]=(state.cart[id]||0)+delta;
  if(state.cart[id]<=0)delete state.cart[id];
  renderCart();
}

function cartLines(){
  return Object.entries(state.cart)
    .map(([id,qty])=>({p:state.products.find(x=>x.id===id),qty}))
    .filter(x=>x.p);
}

function renderCart(){
  const lines=cartLines();
  const count=lines.reduce((a,x)=>a+x.qty,0);
  const total=lines.reduce((a,x)=>a+x.qty*x.p.price,0);

  $('#openCart').classList.toggle('hidden',!count);
  $('#fabCount').textContent=count;
  $('#cartCount').textContent=count?`${count} confezioni/articoli`:'Richiesta vuota';
  $('#cartTotal').textContent=euro(total);

  $('#cartItems').innerHTML=lines.map(x=>`
    <div class="cart-line">
      <div>
        <strong>${esc(x.p.name)}</strong>
        <div class="muted">${esc(x.p.format)} · ${euro(x.p.price)}</div>
      </div>
      <div class="qty">
        <button data-id="${x.p.id}" data-d="-1">−</button>
        <span>${x.qty}</span>
        <button data-id="${x.p.id}" data-d="1">+</button>
      </div>
      <strong>${euro(x.qty*x.p.price)}</strong>
    </div>`
  ).join('');

  $('#cartItems').querySelectorAll('button').forEach(b=>b.onclick=()=>change(b.dataset.id,Number(b.dataset.d)));
  updateAccessWarning();
}

function floorLabel(v){
  if(v==='0')return 'piano terra';
  if(v==='1')return '1° piano';
  if(v==='2')return '2° piano';
  if(v==='3')return '3° piano';
  if(v==='4')return '4° piano';
  return '5° piano o superiore';
}

function elevatorLabel(v){
  if(v==='yes')return 'con ascensore';
  if(v==='no')return 'senza ascensore';
  return 'ascensore non necessario';
}

function dropoffLabel(v){
  return v==='floor'?'consegna al piano richiesta':'consegna al portone/ingresso';
}

function accessIsDemanding(){
  const floor=$('#floor').value;
  const numericFloor=floor==='5+'?5:Number(floor);
  return $('#dropoff').value==='floor' && numericFloor>=2 && $('#elevator').value==='no';
}

function updateAccessWarning(){
  const box=$('#accessWarning');
  if(!box)return;

  if(accessIsDemanding()){
    box.textContent=state.merchant?.delivery_policy?.floor_delivery_note ||
      'Consegna al piano senza ascensore: DG Delivery confermerà la fattibilità in base a piano, quantità e accesso.';
    box.classList.remove('hidden');
  }else{
    box.classList.add('hidden');
    box.textContent='';
  }
}

function orderSnapshot(){
  return {
    at:new Date().toISOString(),
    cart:{...state.cart},
    name:$('#customerName').value.trim(),
    address:$('#customerAddress').value.trim(),
    floor:$('#floor').value,
    elevator:$('#elevator').value,
    dropoff:$('#dropoff').value,
    slot:$('#slot').value,
    notes:$('#notes').value.trim()
  };
}

function prepareWhatsApp(){
  const lines=cartLines();

  if(!lines.length)return alert('Aggiungi almeno un prodotto.');
  if(!$('#customerName').value.trim()||!$('#customerAddress').value.trim()){
    return alert('Inserisci nome e indirizzo di consegna.');
  }

  const snap=orderSnapshot();
  localStorage.setItem('reorder:last',JSON.stringify(snap));

  const total=lines.reduce((a,x)=>a+x.qty*x.p.price,0);
  const access=`${floorLabel(snap.floor)} · ${elevatorLabel(snap.elevator)} · ${dropoffLabel(snap.dropoff)}`;

  const body=[
    `Ciao ${state.merchant.name}, vorrei chiedere conferma per questo ordine:`,
    ...lines.map(x=>`• ${x.qty} × ${x.p.name} (${x.p.format}) — ${euro(x.qty*x.p.price)}`),
    ' ',
    `Totale indicativo: ${euro(total)}`,
    `Consegna: ${snap.slot}`,
    `Nome: ${snap.name}`,
    `Indirizzo: ${snap.address}`,
    `Accesso: ${access}`,
    snap.notes?`Note: ${snap.notes}`:'',
    ' ',
    'Da confermare: disponibilità, prezzo finale e fattibilità della consegna al piano.'
  ].filter(Boolean).join('\n');

  const phone=state.merchant.phone.replace(/\D/g,'');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`,'_blank','noopener');
  restoreLast();
}

function restoreLast(){
  const raw=localStorage.getItem('reorder:last');
  $('#reorderBtn').classList.toggle('hidden',!raw);
}

function reorderLast(){
  try{
    const last=JSON.parse(localStorage.getItem('reorder:last'));

    state.cart={...last.cart};
    $('#customerName').value=last.name||'';
    $('#customerAddress').value=last.address||'';
    $('#floor').value=last.floor||'0';
    $('#elevator').value=last.elevator||'not_needed';
    $('#dropoff').value=last.dropoff||'door';
    $('#slot').value=last.slot||$('#slot').value;
    $('#notes').value=last.notes||'';

    renderCart();
    updateAccessWarning();
    $('#cart').classList.remove('hidden');
  }catch(e){
    localStorage.removeItem('reorder:last');
    restoreLast();
  }
}

boot().catch(err=>{
  document.body.innerHTML=`<main><h1>Errore demo</h1><pre>${esc(err.message)}</pre></main>`;
});