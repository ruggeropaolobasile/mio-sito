const sb=supabase.createClient(REORDER_CONFIG.supabaseUrl,REORDER_CONFIG.publishableKey);
const $=s=>document.querySelector(s);
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let merchant=null;

async function init(){
  document.querySelectorAll('[data-tenant-link]').forEach(a=>a.href=REORDER_WITH_TENANT(a.getAttribute('data-tenant-link')));
  $('#newOrder').href=REORDER_WITH_TENANT('index.html');

  const {data:m,error:me}=await sb.from('reorder_merchants').select('id,slug,name,address').eq('slug',REORDER_TENANT()).eq('active',true).maybeSingle();
  if(me||!m){$('#authMessage').textContent='Merchant non trovato.';return;}
  merchant=m;$('#merchantName').textContent=m.name;

  $('#signIn').onclick=signIn;$('#signUp').onclick=signUp;$('#signOut').onclick=signOut;
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
  setMsg(data.session?'Account creato e accesso effettuato.':'Account creato. Controlla l’email se è richiesta la conferma.');
}

async function signOut(){await sb.auth.signOut();}

function setMsg(s){$('#authMessage').textContent=s;}

async function refreshSession(){
  const {data:{session}}=await sb.auth.getSession();
  const logged=!!session;
  $('#authPanel').classList.toggle('hidden',logged);
  $('#clientPanel').classList.toggle('hidden',!logged);
  $('#sessionBadge').textContent=logged?(session.user.email||'Cliente'):'Non autenticato';
  if(logged)await loadOrders();
}

async function loadOrders(){
  const {data,error}=await sb
    .from('reorder_orders')
    .select('id,public_code,status,total,created_at,address,floor,elevator,dropoff,delivery_slot,notes,customer_name,customer_phone,reorder_order_items(product_id,product_name,product_format,unit_price,qty,line_total)')
    .eq('merchant_id',merchant.id)
    .order('created_at',{ascending:false})
    .limit(30);

  const host=$('#orders');
  if(error){host.innerHTML='<div class="access-warning">'+esc(error.message)+'</div>';return;}
  if(!data?.length){host.innerHTML='<div class="empty-state">Nessun ordine collegato al tuo account. Fai il prossimo ordine mentre sei autenticato.</div>';return;}

  host.innerHTML=data.map(o=>{
    const items=o.reorder_order_items||[];
    return '<article class="order-card"><div class="order-top"><div><strong>'+esc(o.public_code)+'</strong><div class="muted">'+new Date(o.created_at).toLocaleString('it-IT')+' · '+esc(o.address)+'</div></div><span class="badge '+esc(o.status)+'">'+esc(o.status)+'</span></div>'+
      '<div class="form-section">'+items.map(i=>'<div class="row"><span>'+i.qty+' × '+esc(i.product_name)+' <span class="muted">'+esc(i.product_format||'')+'</span></span><strong>'+euro(i.line_total)+'</strong></div>').join('')+
      '<div class="cart-total"><span>Totale</span><strong>'+euro(o.total)+'</strong></div></div>'+
      '<div class="order-actions"><button class="primary-mini" data-reorder="'+o.id+'">Riordina</button></div></article>';
  }).join('');

  host.querySelectorAll('[data-reorder]').forEach(btn=>{
    btn.onclick=()=>{
      const o=data.find(x=>x.id===btn.dataset.reorder);
      const cart={};(o.reorder_order_items||[]).forEach(i=>{if(i.product_id)cart[i.product_id]=i.qty;});
      localStorage.setItem('reorder:pending-cart',JSON.stringify({
        cart,name:o.customer_name||'',phone:o.customer_phone||'',address:o.address||'',
        floor:o.floor||'0',elevator:o.elevator||'not_needed',dropoff:o.dropoff||'door',
        slot:o.delivery_slot||'Oggi - prima fascia disponibile',notes:o.notes||''
      }));
      location.href=REORDER_WITH_TENANT('index.html');
    };
  });
}

init().catch(e=>setMsg(e.message));