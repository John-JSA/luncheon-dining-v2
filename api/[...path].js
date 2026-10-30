import crypto from 'node:crypto';

const MENU = [
  ['goat-gravy','Goat Gravy',300,'10 pieces of goat meat','Stews'],['beef-gravy','Beef Gravy',300,'15 pieces of beef','Stews'],['fried-fish-gravy','Fried Fish Gravy',300,'10 pieces of fried fish','Stews'],['turkey-gravy','Turkey Gravy',300,'10 pieces of fried turkey','Stews'],['palava-sauce','Palava Sauce',300,'10 pieces of protein (smoked fish and beef)','Stews'],['vegetable-egg-sauce','Vegetable Egg Sauce',300,'10 pieces of protein','Stews'],['okro-stew','Okro Stew',300,'10 pieces of protein','Stews'],['groundnut-soup','Groundnut Soup',300,'10 pieces of protein','Soups'],['palm-nut-soup','Palm Nut Soup',300,'10 pieces of protein','Soups'],['fresh-pineapple','Fresh Pineapple Juice',null,'Price on request','Fruit Drinks'],['fresh-watermelon','Fresh Watermelon Juice',null,'Price on request','Fruit Drinks'],['fresh-orange','Fresh Orange Juice',null,'Price on request','Fruit Drinks'],['fresh-mango','Fresh Mango Juice',null,'Price on request','Fruit Drinks'],['fresh-pineapple-ginger','Pineapple & Ginger Drink',null,'Price on request','Fruit Drinks'],['sobolo','Sobolo (Hibiscus Drink)',null,'Price on request','Fruit Drinks'],['lamudzi','Lamudzi (Traditional Ghanaian Drink)',null,'Price on request','Fruit Drinks']
].map(([id,name,price,qty,cat])=>({id,name,price,qty,cat}));
const str=(v,n=400)=>String(v??'').trim().slice(0,n);
const validPhone=p=>/^[+\d][\d\s()+-]{7,22}$/.test(p);
const validEmail=e=>!e||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const tableNames=new Set(['orders','reservations','contacts']);
const allowMethods=(req,res,allowed)=>{if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));res.status(405).json({error:'Method not allowed'});return false}return true};
const fail=(res,status,error)=>res.status(status).json({error});
function adminOK(req){const secret=process.env.ADMIN_TOKEN;const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');if(!secret||!token)return false;const a=Buffer.from(token),b=Buffer.from(secret);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
async function store(table,{method='GET',query='',body}={}){
 if(!tableNames.has(table))throw Error('Invalid table');
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Database is not configured');
 const url=base.replace(/\/$/,'')+'/rest/v1/'+table+(query?'?'+query:'');
 const resp=await fetch(url,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:method==='POST'?'return=minimal':method==='PATCH'?'return=representation':''},body:body?JSON.stringify(body):undefined});
 if(!resp.ok){console.error('Supabase request failed',resp.status,await resp.text());throw Error('Database request failed')}
 const text=await resp.text();return text?JSON.parse(text):null;
}
async function verify(reference){
 const secret=process.env.PAYSTACK_SECRET_KEY;
 if(!secret)return {ok:false,status:'unavailable'};
 const matches=await store('orders',{query:'select=id,total_ghs,payment_status&id=eq.'+encodeURIComponent(reference)+'&limit=1'});
 const row=matches?.[0];if(!row)return {ok:false,status:'not_found'};
 const r=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+secret}});
 const data=await r.json();
 const paid=r.ok&&data.status===true&&data.data?.status==='success'&&data.data?.currency==='GHS'&&data.data?.reference===reference&&Number(data.data?.amount)===row.total_ghs*100;
 if(paid&&row.payment_status!=='paid')await store('orders',{method:'PATCH',query:'id=eq.'+encodeURIComponent(reference),body:{payment_status:'paid'}});
 return {ok:!!paid,status:paid?'paid':(data.data?.status||'pending')};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const path='/'+(Array.isArray(req.query.path)?req.query.path.join('/'):req.query.path||'');
 try{
  if(req.method==='POST'||req.method==='PATCH'){
   if(path!=='/paystack-webhook'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)return fail(res,413,'Request too large');chunks.push(chunk)}try{req.body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{return fail(res,400,'Invalid JSON')}}
  }
  if(path==='/menu'){if(!allowMethods(req,res,['GET']))return;return res.status(200).json({menu:MENU})}
  if(path==='/orders'){
   if(!allowMethods(req,res,['POST']))return;
   const b=req.body||{},name=str(b.customer_name,120),phone=str(b.phone,30),items=Array.isArray(b.items)?b.items:[];
   if(!name||!validPhone(phone)||items.length<1||items.length>40)return fail(res,400,'Provide a name, valid phone and at least one item');
   if(!validEmail(str(b.email,150)))return fail(res,400,'Invalid email address');
   const clean=[];
   for(const item of items){const found=MENU.find(x=>x.id===item.id),quantity=Number(item.quantity);if(!found||!Number.isInteger(quantity)||quantity<1||quantity>100)return fail(res,400,'Invalid menu item or quantity');clean.push({id:found.id,name:found.name,unit_price_ghs:found.price,price_on_request:found.price===null,quantity,line_total_ghs:(found.price||0)*quantity})}
   const method=str(b.payment_method,40),methods=['mobile-money','pay-on-delivery','bank-transfer','paystack'];
   if(!methods.includes(method))return fail(res,400,'Choose a valid payment option');
   if(method==='paystack'&&clean.some(x=>x.price_on_request))return fail(res,400,'Drink prices need a quote before online payment');
   if(method==='paystack'&&(!process.env.PAYSTACK_SECRET_KEY||!str(b.email)))return fail(res,400,'Paystack requires a configured merchant account and customer email');
   const id='LD-'+crypto.randomBytes(5).toString('hex').toUpperCase(),total=clean.reduce((s,x)=>s+x.line_total_ghs,0);
   await store('orders',{method:'POST',body:{id,customer_name:name,phone,whatsapp:str(b.whatsapp,30),email:str(b.email,150),customer_type:str(b.customer_type,40),company:str(b.company,150),delivery_type:str(b.delivery_type,40),address:str(b.address,400),city:str(b.city,120),location_note:str(b.location_note,250),desired_date:str(b.desired_date,40),notes:str(b.notes,1000),items_json:clean,total_ghs:total,payment_method:method,payment_status:'pending',order_status:'new'}});
   if(method==='paystack'){
    try{
     const payload={email:str(b.email,150),amount:total*100,currency:'GHS',reference:id,channels:['card','mobile_money'],metadata:{order_id:id}};
     if(process.env.PUBLIC_BASE_URL)payload.callback_url=process.env.PUBLIC_BASE_URL.replace(/\/$/,'')+'/payment.html';
     const r=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await r.json();
     if(!r.ok||!j.status||!/^https:\/\/checkout\.paystack\.com\//.test(j.data?.authorization_url||''))throw Error('Payment unavailable');
     return res.status(201).json({ok:true,id,total_ghs:total,payment_status:'pending',authorization_url:j.data.authorization_url,message:'Order saved. Complete payment through Paystack.'});
    }catch{return res.status(201).json({ok:true,id,total_ghs:total,payment_status:'pending',message:'Order saved but payment could not start. Contact us with your order reference.'})}
   }
   return res.status(201).json({ok:true,id,total_ghs:total,payment_status:'pending',message:clean.some(x=>x.price_on_request)?'Request saved. Drinks will be quoted before payment.':'Order saved. Payment is NOT yet collected; staff will confirm.'});
  }
  if(path==='/reservations'){
   if(!allowMethods(req,res,['POST']))return;const b=req.body||{},full_name=str(b.full_name,120),phone=str(b.phone,30),event_type=str(b.event_type,100),event_date=str(b.event_date,40),guest_count=Number(b.guest_count);
   if(!full_name||!validPhone(phone)||!event_type||!event_date||!Number.isInteger(guest_count)||guest_count<1||guest_count>100000)return fail(res,400,'Enter name, phone, event type, date and guest count');
   const id='RV-'+crypto.randomBytes(5).toString('hex').toUpperCase();
   await store('reservations',{method:'POST',body:{id,full_name,phone,whatsapp:str(b.whatsapp,30),email:str(b.email,150),organization:str(b.organization,150),event_type,event_date,guest_count,venue_address:str(b.venue_address,400),city:str(b.city,120),notes:str(b.notes,1000),status:'new'}});
   return res.status(201).json({ok:true,id,message:'Reservation request saved. We will contact you to confirm availability.'});
  }
  if(path==='/contacts'){
   if(!allowMethods(req,res,['POST']))return;const b=req.body||{},full_name=str(b.full_name,120),phone=str(b.phone,30),message=str(b.message,1500);
   if(!full_name||!message||(!validPhone(phone)&&!str(b.email,150)))return fail(res,400,'Enter name, message and phone or email');
   const id='CT-'+crypto.randomBytes(5).toString('hex').toUpperCase();
   await store('contacts',{method:'POST',body:{id,full_name,phone,whatsapp:str(b.whatsapp,30),email:str(b.email,150),organization:str(b.organization,150),location:str(b.location,250),message,status:'new'}});
   return res.status(201).json({ok:true,id,message:'Your message was received.'});
  }
  if(path==='/payment-status'){
   if(!allowMethods(req,res,['GET']))return;const reference=str(req.query.reference,40);
   if(!/^LD-[A-F0-9]{10}$/.test(reference))return fail(res,400,'Invalid payment reference');
   return res.status(200).json(await verify(reference));
  }
  if(path==='/paystack-webhook'){
   if(!allowMethods(req,res,['POST']))return;
   if(!process.env.PAYSTACK_SECRET_KEY)return fail(res,503,'Payment not configured');
   // Requires original raw HTTP body; Vercel's JSON parser may normalize it, so disable bodyParser below.
   const chunks=[];for await(const chunk of req){chunks.push(chunk);if(Buffer.concat(chunks).length>500000)return fail(res,413,'Too large')}
   const raw=Buffer.concat(chunks),signed=str(req.headers['x-paystack-signature'],140),expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex'),a=Buffer.from(signed),c=Buffer.from(expected);
   if(a.length!==c.length||!crypto.timingSafeEqual(a,c))return fail(res,401,'Invalid signature');
   const event=JSON.parse(raw.toString('utf8'));
   if(event.event==='charge.success'&&event.data?.reference)await verify(str(event.data.reference,40));
   return res.status(200).json({ok:true});
  }
  if(path.startsWith('/admin/')){
   if(!adminOK(req))return fail(res,401,'Admin access denied');
   const table=path.split('/')[2];if(!tableNames.has(table))return fail(res,404,'Not found');
   if(req.method==='GET'){
    const records=await store(table,{query:'select=*&order=created_at.desc&limit=500'});
    return res.status(200).json({records:(records||[]).map(x=>({...x,items_json:typeof x.items_json==='string'?JSON.parse(x.items_json):x.items_json}))});
   }
   if(req.method==='PATCH'){
    const id=str(req.body?.id,40),status=str(req.body?.status,40),field=table==='orders'?'order_status':'status',allowed=table==='orders'?['new','confirmed','preparing','out-for-delivery','completed','cancelled']:['new','contacted','confirmed','completed','cancelled'];
    if(!/^(LD|RV|CT)-[A-F0-9]{10}$/.test(id)||!allowed.includes(status))return fail(res,400,'Invalid status or reference');
    const result=await store(table,{method:'PATCH',query:'id=eq.'+encodeURIComponent(id),body:{[field]:status}});
    return res.status(result?.length?200:404).json({ok:!!result?.length});
   }
   return fail(res,405,'Method not allowed');
  }
  return fail(res,404,'Not found');
 }catch(e){console.error('API failure',e);return fail(res,503,'The service is temporarily unavailable. Please try again.')} 
}
export const config={api:{bodyParser:false}};
