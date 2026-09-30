const state={merchant:null,products:[],cart:{},category:'Tutti',query:''};
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sbClient=window.supabase?window.supabase.createClient(REORDER_CONFIG.supabaseUrl,REORDER_CONFIG.publishableKey):null;

async function api(path,options={}){
  let token=REORDER_CONFIG.publishableKey;
  if(sbClient){
    const {data}=await sbClient.auth.getSession();
    token=data.session?.access_token||token;
  }
  const res=await fetch(REORDER_CONFIG.supabaseUrl+path,{
    ...options,
    headers:{apikey:REORDER_CONFIG.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}
  });
  if(!res.ok){
    const detail=await res.text();
    throw new Error(detail||('HTTP '+res.status));
  }
  if(res.status===204)return null;
  return res.json();
}

async function boot(){
  const tenant=REORDER_TENANT();
  const merchants=await api('/rest/v1/reorder_merchants?slug=eq.'+encodeURIComponent(tenant)+'&active=eq.true&select=id,slug,name,phone,email,address,theme,delivery_policy,source_note');
  if(!merchants.length)throw new Error('Merchant non trovato: '+tenant);
  state.merchant=merchants[0];

  state.products=await api('/rest/v1/reorder_products?merchant_id=eq.'+state.merchant.id+'&active=eq.true&select=id,sku,category,brand,name,format,pack_qty,price,stock_status,sort_order,metadata&order=sort_order.asc');

  $('#merchantName').textContent=state.merchant.name;
  $('#tagline').textContent=state.merchant.address||'Consegna bevande';
  $('#catalogMeta').textContent=state.products.length+' referenze · backend Supabase reale';
  document.querySelectorAll('[data-tenant-link]').forEach(a=>a.href=REORDER_WITH_TENANT(a.getAttribute('data-tenant-link')));

  const cats=['Tutti',...new Set(state.products.map(p=>p.category))];
  $('#categories').innerHTML=cats.map(c=>'<button class="chip '+(c==='Tutti'?'active':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>').join('');

  $('#categories').addEventListener('click',e=>{
    if(!e.target.matches('.chip'))return;
    state.category=e.target.dataset.cat;
    document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===e.target));
    renderProducts();
  });
  $('#search').addEventListener('input',e=>{state.query=e.target.value.toLowerCase().trim();renderProducts();});
  $('#openCart').onclick=()=>$('#cart').classList.remove('hidden');
  $('#closeCart').onclick=()=>$('#cart').classList.add('hidden');
  $('#checkout').onclick=submitOrder;
  $('#reorderBtn').onclick=reorderLast;
  ['floor','elevator','dropoff'].forEach(id=>$('#'+id).addEventListener('change',updateAccessWarning));

  renderProducts();renderCart();restoreLast();updateAccessWarning();restorePendingReorder();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function visibleProducts(){
  return state.products.filter(p=>
    (state.category==='Tutti'||p.category===state.category)&&
    (!state.query||((p.brand||'')+' '+p.name+' '+(p.format||'')+' '+p.category).toLowerCase().includes(state.query))
  );
}

function renderProducts(){
  const host=$('#products');host.innerHTML='';
  visibleProducts().forEach(p=>{
    const n=$('#productTpl').content.cloneNode(true);
    n.querySelector('.category').textContent=p.category;
    n.querySelector('h3').textContent=p.name;
    n.querySelector('.format').textContent=(p.format||'')+(p.stock_status==='unavailable'?' · non disponibile':'');
    n.querySelector('.price').textContent=euro(p.price);
    const btn=n.querySelector('.add');
    btn.disabled=p.stock_status==='unavailable';
    btn.textContent=p.stock_status==='unavailable'?'Esaurito':'Aggiungi';
    btn.onclick=()=>add(p.id);
    host.appendChild(n);
  });
  if(!host.children.length)host.innerHTML='<p class="muted">Nessun prodotto trovato.</p>';
}

function add(id){state.cart[id]=(state.cart[id]||0)+1;renderCart();}
function change(id,delta){state.cart[id]=(state.cart[id]||0)+delta;if(state.cart[id]<=0)delete state.cart[id];renderCart();}
function cartLines(){return Object.entries(state.cart).map(([id,qty])=>({p:state.products.find(x=>x.id===id),qty})).filter(x=>x.p);}

function renderCart(){
  const lines=cartLines(),count=lines.reduce((a,x)=>a+x.qty,0),total=lines.reduce((a,x)=>a+x.qty*Number(x.p.price),0);
  $('#openCart').classList.toggle('hidden',!count);$('#fabCount').textContent=count;
  $('#cartCount').textContent=count?count+' confezioni/articoli':'Richiesta vuota';$('#cartTotal').textContent=euro(total);
  $('#cartItems').innerHTML=lines.map(x=>'<div class="cart-line"><div><strong>'+esc(x.p.name)+'</strong><div class="muted">'+esc(x.p.format||'')+' · '+euro(x.p.price)+'</div></div><div class="qty"><button data-id="'+x.p.id+'" data-d="-1">−</button><span>'+x.qty+'</span><button data-id="'+x.p.id+'" data-d="1">+</button></div><strong>'+euro(x.qty*Number(x.p.price))+'</strong></div>').join('');
  $('#cartItems').querySelectorAll('button').forEach(b=>b.onclick=()=>change(b.dataset.id,Number(b.dataset.d)));
  updateAccessWarning();
}

function floorLabel(v){return v==='0'?'piano terra':v==='5+'?'5° piano o superiore':v+'° piano';}
function elevatorLabel(v){return v==='yes'?'con ascensore':v==='no'?'senza ascensore':'ascensore non necessario';}
function dropoffLabel(v){return v==='floor'?'consegna al piano richiesta':'consegna al portone/ingresso';}
function accessIsDemanding(){const f=$('#floor').value,n=f==='5+'?5:Number(f);return $('#dropoff').value==='floor'&&n>=2&&$('#elevator').value==='no';}

function updateAccessWarning(){
  const box=$('#accessWarning');if(!box)return;
  if(accessIsDemanding()){
    box.textContent='Consegna al piano senza ascensore: '+state.merchant.name+' confermerà la fattibilità in base a piano, quantità e accesso.';
    box.classList.remove('hidden');
  }else{box.classList.add('hidden');box.textContent='';}
}

function snapshot(){
  return {
    cart:{...state.cart},
    name:$('#customerName').value.trim(),
    phone:$('#customerPhone').value.trim(),
    address:$('#customerAddress').value.trim(),
    floor:$('#floor').value,elevator:$('#elevator').value,dropoff:$('#dropoff').value,
    slot:$('#slot').value,notes:$('#notes').value.trim()
  };
}

async function submitOrder(){
  const lines=cartLines();
  if(!lines.length)return alert('Aggiungi almeno un prodotto.');
  const s=snapshot();
  if(s.name.length<2||s.phone.replace(/\D/g,'').length<8||s.address.length<5)return alert('Inserisci nome, telefono e indirizzo validi.');

  const btn=$('#checkout');btn.disabled=true;btn.textContent='Salvataggio ordine...';
  try{
    const result=await api('/rest/v1/rpc/reorder_create_order',{
      method:'POST',
      body:JSON.stringify({
        p_merchant_slug:state.merchant.slug,
        p_customer_name:s.name,
        p_customer_phone:s.phone,
        p_address:s.address,
        p_floor:s.floor,
        p_elevator:s.elevator,
        p_dropoff:s.dropoff,
        p_delivery_slot:s.slot,
        p_notes:s.notes,
        p_items:lines.map(x=>({product_id:x.p.id,qty:x.qty}))
      })
    });

    const saved={...s,public_code:result.public_code,total:Number(result.total),at:new Date().toISOString()};
    localStorage.setItem('reorder:last',JSON.stringify(saved));
    restoreLast();

    const access=floorLabel(s.floor)+' · '+elevatorLabel(s.elevator)+' · '+dropoffLabel(s.dropoff);
    const body=[
      'Ciao '+state.merchant.name+', ho registrato la richiesta '+result.public_code+':',
      ...lines.map(x=>'• '+x.qty+' × '+x.p.name+' ('+(x.p.format||'')+') — '+euro(x.qty*Number(x.p.price))),
      '',
      'Totale indicativo: '+euro(result.total),
      'Consegna: '+s.slot,
      'Nome: '+s.name,
      'Telefono: '+s.phone,
      'Indirizzo: '+s.address,
      'Accesso: '+access,
      s.notes?'Note: '+s.notes:'',
      '',
      'Da confermare: disponibilità, prezzo finale e fattibilità della consegna.'
    ].filter(Boolean).join('\n');

    const phone=(state.merchant.phone||'').replace(/\D/g,'');
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(body),'_blank','noopener');
    alert('Ordine '+result.public_code+' salvato. Ora puoi inviare il messaggio WhatsApp.');
  }catch(err){
    alert('Ordine non salvato: '+err.message);
  }finally{
    btn.disabled=false;btn.textContent='Registra ordine e prepara WhatsApp';
  }
}

function restoreLast(){const raw=localStorage.getItem('reorder:last');$('#reorderBtn').classList.toggle('hidden',!raw);}

function restorePendingReorder(){
  try{
    const raw=localStorage.getItem('reorder:pending-cart');
    if(!raw)return;
    const p=JSON.parse(raw);
    state.cart={...p.cart};
    $('#customerName').value=p.name||'';
    $('#customerPhone').value=p.phone||'';
    $('#customerAddress').value=p.address||'';
    $('#floor').value=p.floor||'0';
    $('#elevator').value=p.elevator||'not_needed';
    $('#dropoff').value=p.dropoff||'door';
    $('#slot').value=p.slot||$('#slot').value;
    $('#notes').value=p.notes||'';
    localStorage.removeItem('reorder:pending-cart');
    renderCart();updateAccessWarning();$('#cart').classList.remove('hidden');
  }catch(e){localStorage.removeItem('reorder:pending-cart');}
}

function reorderLast(){
  try{
    const last=JSON.parse(localStorage.getItem('reorder:last'));
    state.cart={...last.cart};
    $('#customerName').value=last.name||'';$('#customerPhone').value=last.phone||'';$('#customerAddress').value=last.address||'';
    $('#floor').value=last.floor||'0';$('#elevator').value=last.elevator||'not_needed';$('#dropoff').value=last.dropoff||'door';
    $('#slot').value=last.slot||$('#slot').value;$('#notes').value=last.notes||'';
    renderCart();updateAccessWarning();$('#cart').classList.remove('hidden');
  }catch(e){localStorage.removeItem('reorder:last');restoreLast();}
}

boot().catch(err=>{document.body.innerHTML='<main><h1>Errore</h1><pre>'+esc(err.message)+'</pre></main>';});