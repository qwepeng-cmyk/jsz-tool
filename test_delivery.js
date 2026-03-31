const { callApi } = require('./erp-api.js');

(async () => {
  const orderId = 'gopx20260328234948877437';
  
  console.log('🔍 查询发货单信息:', orderId);
  
  const result = await callApi('gy.erp.trade.deliverys.get', {
    platform_code: orderId
  });
  
  console.log('\n完整返回数据:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result && result.success && result.deliverys && result.deliverys.length > 0) {
    const delivery = result.deliverys[0];
    console.log('\n📦 物流信息:');
    console.log('快递公司:', delivery.express_name);
    console.log('快递代码:', delivery.express_code);
    console.log('快递单号:', delivery.express_no);
  }
})();
