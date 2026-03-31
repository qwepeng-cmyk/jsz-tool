const { callApi } = require('./erp-api.js');

async function testOrder(oid) {
  console.log(`\n🔍 开始全面探测 OID: ${oid}`);
  
  // 1. gy.erp.trade.get
  const r1 = await callApi('gy.erp.trade.get', { platform_code: oid, page_size: 1 });
  console.log('--- trade.get ---');
  console.log('Success:', r1.success);
  console.log('Orders Count:', r1.orders?.length || 0);

  // 2. gy.erp.trade.history.get
  const r2 = await callApi('gy.erp.trade.history.get', { platform_code: oid, page_size: 1 });
  console.log('--- trade.history.get ---');
  console.log('Success:', r2.success);
  console.log('Orders Count:', r2.orders?.length || 0);
  
  if (r2.orders && r2.orders.length > 0) {
    console.log('Found Details:', JSON.stringify(r2.orders[0], null, 2));
  }
}

testOrder('gopx20260312160648390425');
