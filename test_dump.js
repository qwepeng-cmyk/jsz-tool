const { callApi } = require('./erp-api.js');

(async () => {
  const result = await callApi('gy.erp.trade.history.get', {
    page_no: 1,
    page_size: 1
  });
  
  if (result && result.success && result.orders && result.orders.length > 0) {
    console.log(JSON.stringify(result.orders[0], null, 2));
  } else {
    console.log('\n❌ 未找到任何数据');
  }
})();
