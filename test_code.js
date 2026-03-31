const { callApi } = require('./erp-api.js');

(async () => {
  const orderId = 'SDO963938714864';
  
  console.log('🔍 查询发货单信息:', orderId);
  
  const result = await callApi('gy.erp.trade.deliverys.get', {
    code: orderId
  });
  
  if (result && result.success && result.deliverys && result.deliverys.length > 0) {
    console.log(JSON.stringify(result.deliverys[0], null, 2));
  } else {
    console.log('\n❌ 未找到发货单数据');
  }
})();
