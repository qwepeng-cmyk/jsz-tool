const { callApi } = require('./erp-api.js');

async function dumpExpress() {
  console.log('🔍 正在查询管易 ERP 物流单据代码...');
  // 按照管易常见习惯，可能是 gy.erp.express.get
  const result = await callApi('gy.erp.express.get', { page_no: 1, page_size: 100 });
  console.log('\n完整返回数据:');
  console.log(JSON.stringify(result, null, 2));
}

dumpExpress();
