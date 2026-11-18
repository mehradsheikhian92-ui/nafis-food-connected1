const PRODUCTS = [
  ["سوسیس آلمانی","سوسیس",550000,500],
  ["کراکف پنیری","سوسیس",730000,500],
  ["سوسیس بلغاری","سوسیس",650000,500],
  ["سوسیس هات داگ پنیری","سوسیس",680000,500],
  ["سوسیس سوجوک","سوسیس",1200000,500],
  ["سوسیس چورسیتو","سوسیس",1200000,500],
  ["ژامبون مرغ","ژامبون",390000,300],
  ["ژامبون مرغ و قارچ","ژامبون",420000,300],
  ["ژامبون خشک","ژامبون",450000,300],
  ["ژامبون گوشت","ژامبون",650000,300],
  ["ژامبون بوقلمون","ژامبون",420000,300],
  ["ژامبون لبرکزه اتریشی","ژامبون",650000,300],
  ["ژامبون سبزیجات","ژامبون",400000,300],
  ["کالباس سالامی","کالباس",700000,300],
  ["کالباس پپرونی","کالباس",700000,300],
  ["کالباس مارتادلا","کالباس",310000,300]
];

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization"
};

function json(data,status=200){
 return new Response(JSON.stringify(data),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8",...CORS}
 });
}

function normalizeWeight(w,min){
 w=Number(w)||min;
 w=Math.round(w/100)*100;
 return Math.max(min,Math.min(6000,w));
}

async function columnExists(db,table,column){
 const r=await db.prepare(`PRAGMA table_info(${table})`).all();
 return (r.results||[]).some(x=>x.name===column);
}

async function addColumn(db,table,column,type,def){
 if(!(await columnExists(db,table,column))){
  await db.prepare(
   `ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${def}`
  ).run();
 }
}

async function init(db){

 await db.prepare(`
 CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT DEFAULT 'کالباس',
 price INTEGER NOT NULL,
 min_weight INTEGER DEFAULT 300,
 max_weight INTEGER DEFAULT 6000,
 step_weight INTEGER DEFAULT 100,
 discount INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1,
 stock INTEGER DEFAULT 1,
 stock_enabled INTEGER DEFAULT 1
 )`).run();

 await db.prepare(`
 CREATE TABLE IF NOT EXISTS settings(
 key TEXT PRIMARY KEY,
 value TEXT
 )`).run();

 await db.prepare(`
 CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_name TEXT,
 customer_phone TEXT,
 delivery_method TEXT,
 address TEXT,
 delivery_fee INTEGER DEFAULT 0,
 subtotal INTEGER DEFAULT 0,
 total INTEGER DEFAULT 0,
 payment_method TEXT,
 payment_status TEXT DEFAULT 'pending',
 order_status TEXT DEFAULT 'new',
 items TEXT,
 created_at TEXT
 )`).run();

 await addColumn(db,"products","category","TEXT","'کالباس'");
 await addColumn(db,"products","min_weight","INTEGER","300");
 await addColumn(db,"products","max_weight","INTEGER","6000");
 await addColumn(db,"products","step_weight","INTEGER","100");
 await addColumn(db,"products","discount","INTEGER","0");
 await addColumn(db,"products","active","INTEGER","1");
 await addColumn(db,"products","stock","INTEGER","1");
 await addColumn(db,"products","stock_enabled","INTEGER","1");

 await addColumn(db,"orders","delivery_fee","INTEGER","0");
 await addColumn(db,"orders","subtotal","INTEGER","0");
 await addColumn(db,"orders","total","INTEGER","0");
 await addColumn(db,"orders","payment_method","TEXT","'online'");
 await addColumn(db,"orders","payment_status","TEXT","'pending'");
 await addColumn(db,"orders","order_status","TEXT","'new'");

 for(let i=0;i<PRODUCTS.length;i++){
  const p=PRODUCTS[i];

  const exists=await db.prepare(
   "SELECT id FROM products WHERE name=?"
  ).bind(p[0]).first();

  if(!exists){
   await db.prepare(`
   INSERT INTO products
   (name,category,price,min_weight,max_weight,step_weight,discount,active,stock,stock_enabled)
   VALUES(?,?,?,?,?,?,0,1,1,1)
   `).bind(
    p[0],p[1],p[2],p[3],6000,100
   ).run();
  }
 }

 const address=await db.prepare(
  "SELECT value FROM settings WHERE key='pickup_address'"
 ).first();

 if(!address){
  await db.prepare(
   "INSERT INTO settings(key,value) VALUES('pickup_address',?)"
  ).bind("آدرس فروشگاه را از پنل مدیریت وارد کنید").run();
 }

 const fee=await db.prepare(
  "SELECT value FROM settings WHERE key='delivery_fee'"
 ).first();

 if(!fee){
  await db.prepare(
   "INSERT INTO settings(key,value) VALUES('delivery_fee','0')"
  ).run();
 }
}

function auth(request,env){
 const h=request.headers.get("Authorization")||"";
 const token=h.replace("Bearer ","");
 return token && token===env.ADMIN_TOKEN;
}

export default {
 async fetch(request,env){

  if(request.method==="OPTIONS")
   return new Response(null,{headers:CORS});

  const url=new URL(request.url);
  const path=url.pathname;

  try{

   await init(env.DB);

   if(path==="/api/health")
    return json({
     ok:true,
     service:"nafis-food-server",
     database:true,
     time:new Date().toISOString()
    });

   if(path==="/api/products"&&request.method==="GET"){
    const r=await env.DB.prepare(`
      SELECT id,name,category,price,min_weight,max_weight,
      step_weight,discount,active,stock,stock_enabled
      FROM products ORDER BY id
    `).all();

    return json({ok:true,products:r.results||[]});
   }

   if(path==="/api/settings"&&request.method==="GET"){
    const r=await env.DB.prepare(
     "SELECT key,value FROM settings"
    ).all();

    const settings={};
    for(const x of r.results||[])settings[x.key]=x.value;

    return json({ok:true,settings});
   }

   if(path==="/api/order/create"&&request.method==="POST"){

    const body=await request.json();

    if(!body.customer_name||!body.customer_phone)
     return json({ok:false,message:"اطلاعات مشتری ناقص است."},400);

    if(!Array.isArray(body.items)||!body.items.length)
     return json({ok:false,message:"سبد خرید خالی است."},400);

    let subtotal=0;
    const finalItems=[];

    for(const item of body.items){

     const p=await env.DB.prepare(
      "SELECT * FROM products WHERE id=?"
     ).bind(Number(item.product_id)).first();

     if(!p)
      return json({ok:false,message:"محصول پیدا نشد."},400);

     if(!p.active||!p.stock_enabled||!p.stock)
      return json({ok:false,message:`${p.name} ناموجود است.`},400);

     const weight=normalizeWeight(item.weight,p.min_weight);
     const quantity=Math.max(1,Number(item.quantity)||1);

     const price=Math.round(
      Number(p.price)*(100-Number(p.discount||0))/100
     );

     const amount=Math.round(price*weight/1000)*quantity;

     subtotal+=amount;

     finalItems.push({
      product_id:p.id,
      name:p.name,
      weight,
      quantity,
      unit_price:price,
      amount
     });
    }

    let deliveryFee=0;

    if(body.delivery_method==="courier"){
     const setting=await env.DB.prepare(
      "SELECT value FROM settings WHERE key='delivery_fee'"
     ).first();

     deliveryFee=Number(setting?.value||0);
    }

    const total=subtotal+deliveryFee;

    const result=await env.DB.prepare(`
      INSERT INTO orders
      (customer_name,customer_phone,delivery_method,address,
       delivery_fee,subtotal,total,payment_method,payment_status,
       order_status,items,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      body.customer_name,
      body.customer_phone,
      body.delivery_method||"pickup",
      body.address||"",
      deliveryFee,
      subtotal,
      total,
      body.payment_method||"online",
      "pending",
      "new",
      JSON.stringify(finalItems),
      new Date().toISOString()
    ).run();

    const orderId=result.meta.last_row_id;

    if(body.payment_method==="online"){
      return json({
       ok:true,
       order_id:orderId,
       subtotal,
       delivery_fee:deliveryFee,
       total,
       message:"سفارش ایجاد شد. آماده پرداخت آنلاین است."
      });
    }

    return json({
     ok:true,
     order_id:orderId,
     subtotal,
     delivery_fee:deliveryFee,
     total,
     message:"سفارش ثبت شد و منتظر تأیید پرداخت کارت‌به‌کارت است."
    });
   }

   if(path==="/api/admin/login"&&request.method==="POST"){
    const b=await request.json();

    const password=env.ADMIN_PASSWORD||"Nafis1405";

    if(b.password!==password)
     return json({ok:false,message:"رمز عبور اشتباه است."},401);

    return json({
     ok:true,
     token:env.ADMIN_TOKEN||"NAFIS_ADMIN_TOKEN"
    });
   }

   if(path.startsWith("/api/admin/")){

    if(!auth(request,env))
     return json({ok:false,message:"دسترسی غیرمجاز."},401);

    if(path==="/api/admin/products"&&request.method==="GET"){
     const r=await env.DB.prepare(
      "SELECT * FROM products ORDER BY id"
     ).all();

     return json({ok:true,products:r.results||[]});
    }

    if(path==="/api/admin/product/update"&&request.method==="POST"){

     const b=await request.json();

     const id=Number(b.id);

     if(!id)
      return json({ok:false,message:"شناسه محصول نامعتبر است."},400);

     const old=await env.DB.prepare(
      "SELECT * FROM products WHERE id=?"
     ).bind(id).first();

     if(!old)
      return json({ok:false,message:"محصول پیدا نشد."},404);

     const name=b.name??old.name;
     const price=Math.max(0,Number(b.price??old.price));
     const discount=Math.max(0,Math.min(100,Number(b.discount??old.discount)));

     await env.DB.prepare(`
      UPDATE products
      SET name=?,price=?,discount=?
      WHERE id=?
     `).bind(name,price,discount,id).run();

     return json({ok:true,message:"محصول به‌روزرسانی شد."});
    }

    if(path==="/api/admin/product/stock"&&request.method==="POST"){

     const b=await request.json();

     const id=Number(b.id);
     const action=b.action;

     if(action==="out"){
      await env.DB.prepare(
       "UPDATE products SET stock=0 WHERE id=?"
      ).bind(id).run();
     }

     if(action==="in"){
      await env.DB.prepare(
       "UPDATE products SET stock=1 WHERE id=?"
      ).bind(id).run();
     }

     if(action==="disable"){
      await env.DB.prepare(
       "UPDATE products SET stock_enabled=0 WHERE id=?"
      ).bind(id).run();
     }

     if(action==="enable"){
      await env.DB.prepare(
       "UPDATE products SET stock_enabled=1,stock=1 WHERE id=?"
      ).bind(id).run();
     }

     return json({ok:true});
    }

    if(path==="/api/admin/product/delete"&&request.method==="POST"){

     const b=await request.json();

     await env.DB.prepare(
      "DELETE FROM products WHERE id=?"
     ).bind(Number(b.id)).run();

     return json({ok:true});
    }

    if(path==="/api/admin/orders"&&request.method==="GET"){

     const r=await env.DB.prepare(
      "SELECT * FROM orders ORDER BY id DESC"
     ).all();

     return json({ok:true,orders:r.results||[]});
    }

    if(path==="/api/admin/order/update"&&request.method==="POST"){

     const b=await request.json();

     const old=await env.DB.prepare(
      "SELECT * FROM orders WHERE id=?"
     ).bind(Number(b.id)).first();

     if(!old)
      return json({ok:false,message:"سفارش پیدا نشد."},404);

     let fee=Number(b.delivery_fee??old.delivery_fee);

     if(old.payment_status==="paid" &&
        fee!==Number(old.delivery_fee)){
      return json({
       ok:false,
       message:"هزینه ارسال سفارش پرداخت‌شده قابل تغییر نیست."
      },400);
     }

     const total=Number(old.subtotal)+fee;

     await env.DB.prepare(`
      UPDATE orders
      SET delivery_fee=?,total=?,order_status=?,payment_status=?
      WHERE id=?
     `).bind(
      fee,
      total,
      b.order_status??old.order_status,
      b.payment_status??old.payment_status,
      Number(b.id)
     ).run();

     return json({ok:true});
    }

    if(path==="/api/admin/settings"&&request.method==="POST"){

     const b=await request.json();

     if(b.pickup_address!==undefined){
      await env.DB.prepare(`
       INSERT INTO settings(key,value)
       VALUES('pickup_address',?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `).bind(String(b.pickup_address)).run();
     }

     if(b.delivery_fee!==undefined){
      await env.DB.prepare(`
       INSERT INTO settings(key,value)
       VALUES('delivery_fee',?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `).bind(String(Math.max(0,Number(b.delivery_fee)))).run();
     }

     return json({ok:true});
    }

    return json({ok:false,message:"مسیر مدیریتی پیدا نشد."},404);
   }

   if(path==="/api/payment/start"&&request.method==="POST"){
    return json({
     ok:false,
     message:"درگاه پرداخت هنوز به اطلاعات پذیرنده واقعی نیاز دارد."
    },501);
   }

   return json({ok:false,message:"مسیر پیدا نشد."},404);

  }catch(error){

   return json({
    ok:false,
    message:"خطای داخلی سرور.",
    error:String(error)
   },500);
  }
 }
};