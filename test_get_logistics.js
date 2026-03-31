const { callApi } = require('./erp-api.js');

(async () => {
  // 使用之前上传成功的订单号
  const platform_code = 'gopx20260325143925691139';
  
  console.log('🔍 查询订单物流信息:', platform_code);
  
  const result = await callApi('gy.erp.trade.get', {
    platform_code: platform_code,
    page_no: 1,
    page_size: 1
  });
  
  console.log('\n返回结果:');
  console.log(JSON.stringify(result, null, 2));
  
  if (result && result.success && result.orders && result.orders.length > 0) {
    const order = result.orders[0];
    console.log('\n📦 物流信息:');
    console.log('物流公司名称:', order.express_name || '未设置');
    console.log('物流公司代码:', order.express_code || '未设置');
    console.log('物流单号:', order.mail_no || '未发货');
  } else {
    console.log('\n❌ 未找到订单或订单未发货');
  }
})();
