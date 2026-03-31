const { callApi } = require('./erp-api.js');

const orderIds = [
  'gopx20260328234948877437',
  'gopx20260328210009964225',
  'gopx20260328181524624613',
  'gopx20260328180738198404',
  'gopx20260328174242476119',
  'gopx20260328173147968933',
  'gopx20260328155806821515',
  'gopx20260328123724369593',
  'gopx20260328091835959224',
  'gopx20260328090946259364',
  'gopx20260327224544857974'
];

(async () => {
  console.log('🔍 批量查询订单物流信息\n');
  
  for (const orderId of orderIds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`订单号: ${orderId}`);
    
    const result = await callApi('gy.erp.trade.get', {
      platform_code: orderId,
      page_no: 1,
      page_size: 1
    });
    
    if (result && result.success && result.orders && result.orders.length > 0) {
      const order = result.orders[0];
      console.log(`系统单号: ${order.code}`);
      console.log(`物流公司: ${order.express_name || '未设置'}`);
      console.log(`物流代码: ${order.express_code || '未设置'}`);
      console.log(`物流单号: ${order.mail_no || '未发货'}`);
    } else {
      console.log('❌ 未找到订单');
    }
    
    // 延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 查询完成');
})();
