const { callApi } = require('./erp-api.js');

(async () => {
  const orderId = 'gopx20260328234948877437';
  
  console.log('🔍 查询订单详细信息:', orderId);
  
  const result = await callApi('gy.erp.trade.get', {
    platform_code: orderId
  });
  
  console.log('\n完整返回数据:');
  console.log(JSON.stringify(result, null, 2));
})();
