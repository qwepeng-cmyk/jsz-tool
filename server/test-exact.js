const { callApi } = require('../erp-api.js');
const db = require('better-sqlite3')('database.sqlite');

(async () => {
    const orderId = 'gopx202603291211392953';
    console.log("Fetching from SQLite for order:", orderId);
    let row = db.prepare('SELECT order_data FROM orders WHERE order_id = ?').get(orderId);
    if (!row) return console.log("Not found in DB");
    
    let order_data = JSON.parse(row.order_data);
    
    // We need to format it using upload_order.py logic or just run the upload script
    console.log("Running python script to generate json...");
})();
