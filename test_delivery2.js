const { callApi } = require('./erp-api.js');

(async () => {
  // 使用系统单号查询
  const systemCode = 'SDO963938714864';
  
  console.log('🔍 使用系统单号查询发货单:', systemCode);
  
  const result = await callApi('gy.erp.trade.deliverys.get', {
    code: systemCode
  });
  
  console.log('\n返回结果:');
  console.log(JSON.stringify(result, null, 2));
})();
