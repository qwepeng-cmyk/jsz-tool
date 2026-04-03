
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'database.sqlite'));

const query = `
    SELECT 
        order_id, 
        status_warehouse,
        order_data 
    FROM orders 
    WHERE order_data LIKE '%速冻牛肉饺子1kg%'
`;

const rows = db.prepare(query).all();
let output = "【异常订单审计报告 - 速冻牛肉饺子1kg】\n";
output += "生成时间: " + new Date().toLocaleString() + "\n";
output += "=".repeat(80) + "\n\n";

rows.forEach((row, i) => {
    const data = JSON.parse(row.order_data);
    const names = data['商品名称'].replace(/^"|"$/g, '').split('" "');
    const nums = data['商品数量'].replace(/^"|"$/g, '').split('" "');
    const synced = row.status_warehouse === 1;

    output += `序号: ${i + 1}\n`;
    output += `订单号: ${row.order_id}\n`;
    output += `下单人: ${data['收货人'] || '-'}\n`;
    output += `联系电话: ${data['联系电话'] || '-'}\n`;
    output += `下单时间: ${data['创建时间'] || '-'}\n`;
    output += `同步状态: ${synced ? '【⚠️ 已推送仓库 - 存在漏货风险】' : '【⏳ 待同步 - 拦截成功】'}\n`;
    output += `涉及商品:\n`;
    names.forEach((name, idx) => {
        output += `   - ${name} (数量: ${nums[idx] || '1'})\n`;
    });
    output += "-".repeat(40) + "\n\n";
});

fs.writeFileSync(path.join(__dirname, 'report_missing_dumplings.txt'), output);
console.log(`✅ 报告已生成：${rows.length} 笔订单，请查收！`);
