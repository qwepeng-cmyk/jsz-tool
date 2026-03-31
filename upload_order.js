const { callApi } = require('./erp-api.js');
const fs = require('fs');

async function checkVipExists(vipCode) {
  const result = await callApi('gy.erp.vip.get', { code: vipCode });
  return result && result.success && result.vips && result.vips.length > 0;
}

async function createVip(vipCode, name, orderData) {
  const result = await callApi('gy.erp.vip.add', {
    code: vipCode,
    name: name,
    shop_code: "301535",
    receive_infos: [
      {
        name: "默认地址",
        receiver: orderData.receiver_name,
        mobile: orderData.receiver_mobile,
        province: orderData.receiver_province,
        city: orderData.receiver_city,
        district: orderData.receiver_district,
        address: orderData.receiver_address,
        zip: orderData.receiver_zip
      }
    ]
  });
  return result && result.success;
}

async function uploadOrder(orderData) {
  const result = await callApi('gy.erp.trade.add', orderData);

  if (result && result.errorDesc && result.errorDesc.includes('平台单号已存在')) {
    return { success: false, duplicate: true };
  }

  return result;
}

(async () => {
  const orderData = JSON.parse(fs.readFileSync('order_to_upload.json', 'utf8'));

  console.log('📤 准备推送订单:', orderData.platform_code);

  // 1. 检查会员是否存在
  console.log('\n🔍 检查会员:', orderData.vip_code);
  const vipExists = await checkVipExists(orderData.vip_code);

  if (vipExists) {
    console.log('✅ 会员已存在');
  } else {
    console.log('⚠️ 会员不存在，创建中...');
    const created = await createVip(orderData.vip_code, orderData.receiver_name, orderData);
    if (created) {
      console.log('✅ 会员创建成功');
    } else {
      console.log('❌ 会员创建失败');
    }
  }

  // 2. 上传订单
  console.log('\n📤 上传订单...');
  const result = await uploadOrder(orderData);

  console.log('\n返回结果:');
  console.log(JSON.stringify(result, null, 2));

  if (result.duplicate) {
    console.log('\n❌ 订单号已存在，不允许重复上传');
    process.exit(1);
  }

  if (result && result.success) {
    console.log('\n✅ 订单推送成功');
    console.log('系统单号:', result.code);
    console.log('平台单号:', orderData.platform_code);
  } else {
    console.log('\n❌ 订单推送失败');
  }
})();
