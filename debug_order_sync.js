
const Database = require('better-sqlite3');
const path = require('path');

// 模拟核心匹配算法（摘自 index.js 逻辑）
async function diagnosticMatch(orderId) {
    const db = new Database(path.join(__dirname, 'server/database.sqlite'));
    const order = db.prepare('SELECT order_data FROM orders WHERE order_id = ?').get(orderId);
    
    if (!order) return console.log("❌ 未找到该订单");
    const data = JSON.parse(order.order_data);
    
    const namesRaw = data['商品名称'] || '';
    const numsRaw = data['商品数量'] || '';
    
    // 关键：现在的解析算法是基于引号加空格分割的
    const names = namesRaw.replace(/^"|"$/g, '').split('" "');
    const nums = numsRaw.replace(/^"|"$/g, '').split('" "');
    
    console.log(`\n📋 订单: ${orderId}`);
    console.log(`📦 商城商品清单:`, names);
    
    const mappings = db.prepare('SELECT * FROM product_mappings').all();
    const syncedItems = [];
    
    names.forEach((name, idx) => {
        let matched = null;
        for (const m of mappings) {
            if (name.includes(m.keyword)) {
                matched = m;
                break;
            }
        }
        
        if (matched) {
            console.log(`✅ [OK] 商品 [${name}] -> 匹配成功 [SKU: ${matched.item_code}]`);
            syncedItems.push({ name, code: matched.item_code, qty: nums[idx] });
        } else {
            console.log(`❌ [FAIL] 商品 [${name}] -> 匹配失败！该商品将被丢弃！`);
        }
    });
    
    console.log(`\n🚀 最终推送给仓库的商品数量: ${syncedItems.length} (原始数量: ${names.length})`);
    
    if (syncedItems.length === 0) {
        console.log("⚠️ 警告：该订单因为所有商品均未匹配到映射，将不会推送到仓库。");
    } else if (syncedItems.length < names.length) {
        console.log("⚠️ 警告：该订单发生了【部分丢单】，因为部分商品没有映射规则！");
    }
}

// 执行诊断
diagnosticMatch('gopx20260328210009964225');
