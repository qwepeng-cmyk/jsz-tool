const { callApi } = require('./erp-api.js');

async function probe(oid) {
  console.log(`\n🕵️ 深度探测订单: ${oid}`);
  
  // 方法 1: 普通查询 (不带日期)
  console.log('--- 方法 1: trade.get (不带日期) ---');
  const r1 = await callApi('gy.erp.trade.get', { platform_code: oid, page_size: 1 });
  if (r1 && r1.success && r1.orders && r1.orders.length > 0) {
    console.log('✅ 找到记录:', r1.orders[0].code);
  } else {
    console.log('❌ 未找到');
  }

  // 方法 2: 历史查询 (不带日期)
  console.log('--- 方法 2: trade.history.get (不带日期) ---');
  const r2 = await callApi('gy.erp.trade.history.get', { platform_code: oid, page_size: 1 });
  if (r2 && r2.success && r2.orders && r2.orders.length > 0) {
    console.log('✅ 找到记录:', r2.orders[0].code);
  } else {
    console.log('❌ 未找到');
  }

  // 方法 3: 详情查询 (尝试直接用 OID 作为 code，虽然通常不行)
  console.log('--- 方法 3: trade.detail.get (code = oid) ---');
  const r3 = await callApi('gy.erp.trade.detail.get', { code: oid });
  if (r3 && r3.success) {
    console.log('✅ 找到详情');
  } else {
    console.log('❌ 未找到');
  }
}

probe('gopx20260312160648390425');
