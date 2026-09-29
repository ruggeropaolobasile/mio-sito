const state={merchant:null,products:[],cart:{},category:'Tutti',query:''};
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function boot(){
  const [merchant,products]=await Promise.all([fetch('data/merchant.json').then(r=>r.json()),fetch('data/products.json').then(r=>r.json())]);
  state.merchant=merchant; state.products=products.filter(p=>p.active);
  $('#merchantName').textContent=merchant.name; $('#tagline').textContent=merchant.tagline;
  $('#catalogMeta').textContent=`${state.products.length} referenze demo · listino pubblico ${merchant.source.catalog_published.split('-').reverse().join('/')}`;
  const cats=['Tutti',...new Set(state.products.map(p=>p.category))];
  $('#categories').innerHTML=cats.map(c=>`<button class="chip ${c==='Tutti'?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $('#categories').addEventListener('click',e=>{if(!e.target.matches('.chip'))return;state.category=e.target.dataset.cat;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===e.target));renderProducts();});
  $('#search').addEventListener('input',e=>{state.query=e.target.value.toLowerCase().trim();renderProducts();});
  $('#openCart').onclick=()=>$('#cart').classList.remove('hidden'); $('#closeCart').onclick=()=>$('#cart').classList.add('hidden');
  $('#checkout').onclick=prepareWhatsApp; $('#reorderBtn').onclick=reorderLast;
  renderProducts(); renderCart(); restoreLast();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function visibleProducts(){return state.products.filter(p=>(state.category==='Tutti'||p.category===state.category)&&(!state.query||`${p.brand} ${p.name} ${p.format} ${p.category}`.toLowerCase().includes(state.query)));}
function renderProducts(){const host=$('#products');host.innerHTML='';visibleProducts().forEach(p=>{const n=$('#productTpl').content.cloneNode(true);n.querySelector('.category').textContent=p.category;n.querySelector('h3').textContent=p.name;n.querySelector('.format').textContent=p.format;n.querySelector('.price').textContent=euro(p.price);n.querySelector('.add').onclick=()=>add(p.id);host.appendChild(n);});if(!host.children.length)host.innerHTML='<p class="muted">Nessun prodotto trovato.</p>';}
function add(id){state.cart[id]=(state.cart[id]||0)+1;renderCart();}
function change(id,delta){state.cart[id]=(state.cart[id]||0)+delta;if(state.cart[id]<=0)delete state.cart[id];renderCart();}
function cartLines(){return Object.entries(state.cart).map(([id,qty])=>({p:state.products.find(x=>x.id===id),qty})).filter(x=>x.p);}
function renderCart(){const lines=cartLines(),count=lines.reduce((a,x)=>a+x.qty,0),total=lines.reduce((a,x)=>a+x.qty*x.p.price,0);$('#openCart').classList.toggle('hidden',!count);$('#fabCount').textContent=count;$('#cartCount').textContent=count?`${count} confezioni/articoli`:'Ordine vuoto';$('#cartTotal').textContent=euro(total);$('#cartItems').innerHTML=lines.map(x=>`<div class="cart-line"><div><strong>${esc(x.p.name)}</strong><div class="muted">${esc(x.p.format)} · ${euro(x.p.price)}</div></div><div class="qty"><button data-id="${x.p.id}" data-d="-1">−</button><span>${x.qty}</span><button data-id="${x.p.id}" data-d="1">+</button></div><strong>${euro(x.qty*x.p.price)}</strong></div>`).join('');$('#cartItems').querySelectorAll('button').forEach(b=>b.onclick=()=>change(b.dataset.id,Number(b.dataset.d)));}
function orderSnapshot(){return {at:new Date().toISOString(),cart:{...state.cart},name:$('#customerName').value.trim(),address:$('#customerAddress').value.trim(),slot:$('#slot').value,notes:$('#notes').value.trim()};}
function prepareWhatsApp(){const lines=cartLines();if(!lines.length)return alert('Aggiungi almeno un prodotto.');if(!$('#customerName').value.trim()||!$('#customerAddress').value.trim())return alert('Inserisci nome e indirizzo di consegna.');const snap=orderSnapshot();localStorage.setItem('reorder:last',JSON.stringify(snap));const total=lines.reduce((a,x)=>a+x.qty*x.p.price,0);const body=[`Ciao ${state.merchant.name}, vorrei ordinare:`,...lines.map(x=>`• ${x.qty} × ${x.p.name} (${x.p.format}) — ${euro(x.qty*x.p.price)}`),` `,`Totale indicativo: ${euro(total)}`,`Consegna: ${snap.slot}`,`Nome: ${snap.name}`,`Indirizzo: ${snap.address}`,snap.notes?`Note: ${snap.notes}`:'',` `,`POC: prezzi/disponibilita da confermare.`].filter(Boolean).join('\n');const phone=state.merchant.phone.replace(/\D/g,'');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`,'_blank','noopener');restoreLast();}
function restoreLast(){const raw=localStorage.getItem('reorder:last');$('#reorderBtn').classList.toggle('hidden',!raw);}
function reorderLast(){try{const last=JSON.parse(localStorage.getItem('reorder:last'));state.cart={...last.cart};$('#customerName').value=last.name||'';$('#customerAddress').value=last.address||'';$('#slot').value=last.slot||$('#slot').value;$('#notes').value=last.notes||'';renderCart();$('#cart').classList.remove('hidden');}catch(e){localStorage.removeItem('reorder:last');restoreLast();}}
boot().catch(err=>{document.body.innerHTML=`<main><h1>Errore demo</h1><pre>${esc(err.message)}</pre></main>`;});