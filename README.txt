نفیس فود - فایل آماده
رمز پنل ادمین: Nafis@1405

public/index.html = سایت مشتری
public/admin.html = پنل مدیریت
worker.js = Cloudflare Worker
schema.sql = ساخت دیتابیس D1
wrangler.toml = تنظیمات

قبل از Deploy در Cloudflare باید D1 بسازی و database_id واقعی را در wrangler.toml قرار دهی. سپس schema.sql را روی D1 اجرا کن.


Worker URL configured in the HTML files:
https://wispy-shape-dafc.nafis-food123.workers.dev
