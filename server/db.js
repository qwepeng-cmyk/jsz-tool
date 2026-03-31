const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    platform_code TEXT,
    shipping_name TEXT,
    express_no TEXT,
    status_warehouse INTEGER DEFAULT 0,
    status_logistics INTEGER DEFAULT 0,
    order_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE,
    item_code TEXT,
    item_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    status TEXT,
    summary TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add trigger_type to sync_logs if not present
try {
  db.prepare("ALTER TABLE sync_logs ADD COLUMN trigger_type TEXT DEFAULT 'MANUAL'").run();
  console.log('✅ 数据库迁移成功: 已增加 trigger_type 列');
} catch (e) {
  // If column already exists, this will error
  if (!e.message.includes('duplicate column name')) {
    console.warn('⚠️ 数据库迁移提醒:', e.message);
  }
}

const configCount = db.prepare("SELECT count(*) as c FROM system_config").get().c;
if (configCount === 0) {
  const insertConfig = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?)");
  insertConfig.run("cron_hours_order_sync", "11,15");
  insertConfig.run("cron_hours_logistics_sync", "17");
  insertConfig.run("auto_sync_enabled", "1");
}

// Insert initial mappings if empty
const count = db.prepare('SELECT count(*) as c FROM product_mappings').get().c;
if (count === 0) {
    const defaultMappings = [
        { keyword: '速冻牛肉肉馕', item_code: '6976308022034', item_name: '疆手作原味速冻生牛肉烤包子(烤箱、空炸专享)' },
        { keyword: '速冻牛肉薄皮包子', item_code: '6976308020009', item_name: '疆手作速冻生牛肉薄皮包子(蒸锅蒸煮)' },
        { keyword: '速冻牛肉发面包子', item_code: '6976308020016', item_name: '疆手作速冻牛肉发面包子(蒸锅蒸煮)' },
        { keyword: '速冻牛肉馄饨1kg', item_code: '6976308020115', item_name: '疆手作速冻牛肉馄饨曲曲大包装' },
        { keyword: '速冻牛肉馄饨500g', item_code: '6976308020108', item_name: '疆手作速冻牛肉馄饨曲曲' },
        { keyword: '速冻牛肉饺子500g', item_code: '6976308020122', item_name: '疆手作速冻牛肉水饺' },
        { keyword: '速冻苜蓿馄饨', item_code: '6976308020146', item_name: '速冻苜蓿肉馄饨' }
    ];
    const insert = db.prepare('INSERT INTO product_mappings (keyword, item_code, item_name) VALUES (@keyword, @item_code, @item_name)');
    const insertMany = db.transaction((maps) => {
        for (const map of maps) insert.run(map);
    });
    insertMany(defaultMappings);
}

module.exports = db;
