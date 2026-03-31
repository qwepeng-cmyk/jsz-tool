const { callApi } = require('./erp-api.js');

(async () => {
  const orderId = 'SDO963938714864';
  
  console.log('🔍 查询历史订单详情:', orderId);
  
  const result = await callApi('gy.erp.trade.history.get', {
    code: orderId
  });
  
  if (result && result.success && result.orders && result.orders.length > 0) {
    console.log(JSON.stringify(result.orders[0], null, 2));
  } else {
    console.log('\n❌ 未找到历史订单数据');
  }
})();
