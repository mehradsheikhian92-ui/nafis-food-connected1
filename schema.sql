CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    image TEXT NOT NULL DEFAULT '🥩',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT DEFAULT '',
    items_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'در انتظار پرداخت',
    created_at TEXT NOT NULL
);

INSERT INTO products
(name,price,image,created_at)
SELECT
'سوپری',
1200000,
'🥩',
datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM products
    WHERE name='سوپری'
);

INSERT INTO products
(name,price,image,created_at)
SELECT
'سوجوق',
1200000,
'🌭',
datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM products
    WHERE name='سوجوق'
);

INSERT INTO products
(name,price,image,created_at)
SELECT
'مرغ',
390000,
'🍗',
datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM products
    WHERE name='مرغ'
);

INSERT INTO products
(name,price,image,created_at)
SELECT
'کاهو',
80000,
'🥬',
datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM products
    WHERE name='کاهو'
);