const sb=supabase.createClient(REORDER_CONFIG.supabaseUrl,REORDER_CONFIG.publishableKey);
const $=s=>document.querySelector(s);
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel={new:'Nuovo',accepted:'Accettato',ready:'Pronto',delivered:'Consegnato',cancelled:'Annullato'};
let merchant=null;

async function init(){
  document.querySelectorAll('[data-tenant-link]').forEach(a=>a.href=REORDER_WITH_TENANT(a.getAttribute('data-tenant-link')));
  $('#signIn').onclick=signIn;$('#signUp').onclick=signUp;$('#signOut').onclick=()=>sb.auth.signOut();
  $('#refreshOrders').onclick=loadOrders;$('#addProduct').onclick=addProduct;$('#saveSettings').onclick=saveSettings;
  document.querySelectorAll('.tabBtn').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  sb.auth.onAuthStateChange(()=>refreshSession());
  await refreshSession();
}

async function signIn(){
  setMsg('Accesso...');
  const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  setMsg(error?error.message:'Accesso effettuato.');
}

async function signUp(){
  setMsg('Creazione account...');
  const {data,error}=await sb.auth.signUp({email:$('#email').value.trim(),password:$('#password').value});
  if(error)return setMsg(error.message);
  setMsg(data.session?'Account creato.':'Account creato. Se richiesto, conferma l’email e poi accedi.');
}

function setMsg(s){$('#authMessage').textContent=s;}

async function refreshSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){$('#authPanel').classList.remove('hidden');$('#adminPanel').classList.add('hidden');$('#adminBadge').textContent='Non autenticato';return;}

  const {data:m,error:me}=await sb.from('reorder_merchants').select('*').eq('slug',REORDER_TENANT()).maybeSingle();
  if(me||!m){setMsg(me?.message||'Merchant non trovato');await sb.auth.signOut();return;}
  merchant=m;

  const {data:adminRows,error:ae}=await sb.from('reorder_admin_emails').select('email,role').eq('merchant_id',merchant.id);
  if(ae||!adminRows?.length){
    setMsg('Account autenticato ma non autorizzato per questo merchant.');
    $('#adminBadge').textContent='Accesso negato';
    $('#authPanel').classList.remove('hidden');$('#adminPanel').classList.add('hidden');
    return;
  }

  $('#merchantName').textContent=merchant.name;$('#adminBadge').textContent=session.user.email||'Admin';
  $('#authPanel').classList.add('hidden');$('#adminPanel').classList.remove('hidden');
  $('#merchantPhone').value=merchant.phone||'';$('#merchantAddress').value=merchant.address||'';
  $('#sameDay').value=String(merchant.delivery_policy?.same_day!==false);
  $('#stairsPolicy').value=merchant.delivery_policy?.high_floor_without_elevator||'confirm';

  await Promise.all([loadOrders(),loadProducts()]);
}

function showTab(name){
  document.querySelectorAll('.adminTab').forEach(x=>x.classList.add('hidden'));
  $('#tab-'+name).classList.remove('hidden');
}

async function loadOrders(){
  const {data,error}=await sb.from('reorder_orders')
    .select('id,public_code,status,total,created_at,customer_name,customer_phone,address,floor,elevator,dropoff,delivery_slot,notes,reorder_order_items(product_name,product_format,unit_price,qty,line_total)')
    .eq('merchant_id',merchant.id).order('created_at',{ascending:false}).limit(100);
  if(error){$('#orders').innerHTML='<div class="access-warning">'+esc(error.message)+'</div>';return;}

  const counts={new:0,accepted:0,ready:0,delivered:0};(data||[]).forEach(o=>{if(counts[o.status]!==undefined)counts[o.status]++;});
  $('#statNew').textContent=counts.new;$('#statAccepted').textContent=counts.accepted;$('#statReady').textContent=counts.ready;$('#statDelivered').textContent=counts.delivered;

  if(!data?.length){$('#orders').innerHTML='<div class="empty-state">Nessun ordine.</div>';return;}
  $('#orders').innerHTML=data.map(o=>{
    const next=o.status==='new'?'accepted':o.status==='accepted'?'ready':o.status==='ready'?'delivered':null;
    const nextText=next==='accepted'?'Accetta':next==='ready'?'Segna pronto':next==='delivered'?'Segna consegnato':'';
    return '<article class="order-card"><div class="order-top"><div><strong>'+esc(o.public_code)+'</strong><div>'+esc(o.customer_name)+' · '+esc(o.customer_phone||'')+'</div><div class="muted">'+esc(o.address)+' · '+esc(o.floor||'')+' · '+esc(o.elevator||'')+'</div></div><span class="badge '+esc(o.status)+'">'+esc(statusLabel[o.status]||o.status)+'</span></div>'+
      '<div class="form-section">'+(o.reorder_order_items||[]).map(i=>'<div class="row"><span>'+i.qty+' × '+esc(i.product_name)+' <span class="muted">'+esc(i.product_format||'')+'</span></span><strong>'+euro(i.line_total)+'</strong></div>').join('')+
      '<div class="cart-total"><span>Totale</span><strong>'+euro(o.total)+'</strong></div></div>'+
      (o.notes?'<div class="access-warning">Note: '+esc(o.notes)+'</div>':'')+
      '<div class="order-actions">'+(next?'<button class="primary-mini" data-order="'+o.id+'" data-status="'+next+'">'+nextText+'</button>':'')+
      (o.status!=='cancelled'&&o.status!=='delivered'?'<button data-order="'+o.id+'" data-status="cancelled">Annulla</button>':'')+'</div></article>';
  }).join('');

  $('#orders').querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>updateOrder(b.dataset.order,b.dataset.status));
}

async function updateOrder(id,status){
  const {error}=await sb.from('reorder_orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  await loadOrders();
}

async function loadProducts(){
  const {data,error}=await sb.from('reorder_products').select('id,sku,category,name,format,price,active,stock_status').eq('merchant_id',merchant.id).order('sort_order');
  if(error){$('#productsAdmin').innerHTML='<div class="access-warning">'+esc(error.message)+'</div>';return;}
  $('#productsAdmin').innerHTML=(data||[]).map(p=>'<article class="order-card"><div class="order-top"><div><strong>'+esc(p.name)+'</strong><div class="muted">'+esc(p.category)+' · '+esc(p.format||'')+' · '+esc(p.sku)+'</div></div><span class="badge">'+(p.active?'Attivo':'Nascosto')+'</span></div><div class="two-cols" style="margin-top:10px"><input type="number" step="0.01" min="0" value="'+Number(p.price).toFixed(2)+'" data-price="'+p.id+'"><select data-active="'+p.id+'"><option value="true" '+(p.active?'selected':'')+'>Attivo</option><option value="false" '+(!p.active?'selected':'')+'>Nascosto</option></select></div><div class="order-actions"><button class="primary-mini" data-save-product="'+p.id+'">Salva</button></div></article>').join('');
  $('#productsAdmin').querySelectorAll('[data-save-product]').forEach(b=>b.onclick=()=>saveProduct(b.dataset.saveProduct));
}

async function saveProduct(id){
  const price=Number(document.querySelector('[data-price="'+id+'"]').value);
  const active=document.querySelector('[data-active="'+id+'"]').value==='true';
  const {error}=await sb.from('reorder_products').update({price,active,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  await loadProducts();
}

async function addProduct(){
  const category=$('#newCategory').value.trim(),name=$('#newName').value.trim(),format=$('#newFormat').value.trim(),price=Number($('#newPrice').value);
  if(!category||!name||!Number.isFinite(price))return alert('Completa categoria, nome e prezzo.');
  const sku='manual-'+Date.now();
  const {error}=await sb.from('reorder_products').insert({merchant_id:merchant.id,sku,category,name,format,price,active:true,stock_status:'unknown'});
  if(error)return alert(error.message);
  $('#newCategory').value='';$('#newName').value='';$('#newFormat').value='';$('#newPrice').value='';
  await loadProducts();
}

async function saveSettings(){
  const policy={...(merchant.delivery_policy||{}),same_day:$('#sameDay').value==='true',high_floor_without_elevator:$('#stairsPolicy').value};
  const {data,error}=await sb.from('reorder_merchants').update({phone:$('#merchantPhone').value.trim(),address:$('#merchantAddress').value.trim(),delivery_policy:policy,updated_at:new Date().toISOString()}).eq('id',merchant.id).select().single();
  if(error)return alert(error.message);
  merchant=data;alert('Impostazioni salvate.');
}

init().catch(e=>setMsg(e.message));