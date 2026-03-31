const { callApi } = require('./erp-api.js');
const axios = require('axios');
const fs = require('fs');

// 商城配置
const MALL_BASE_URL = 'https://666.dianzhushoukeji.com';
const MALL_USERNAME = '18800180305';
const MALL_PASSWORD = '123456';

// 物流公司映射
const EXPRESS_MAPPING = JSON.parse(fs.readFileSync('express_mapping.json', 'utf8'));

// 商城登录
async function mallLogin() {
  const response = await axios.post(`${MALL_BASE_URL}/merchant-backend-pc/shop/login`, {
    admin: {
      password: MALL_PASSWORD,
      mobile: MALL_USERNAME
    }
  });

  if (response.data.code === 0) {
    return response.data.result.token;
  }
  throw new Error('商城登录失败: ' + response.data.message);
}

// 从仓库查询发货单
async function getDeliveryFromWarehouse(platformCode) {
  const result = await callApi('gy.erp.trade.deliverys.get', {
    platform_code: platformCode,
    page_no: '1',
    page_size: '1'
  });

  if (result && result.success && result.deliverys && result.deliverys.length > 0) {
    const delivery = result.deliverys[0];
    return {
      expressName: delivery.express_name,
      expressNo: delivery.express_no
    };
  }

  return null;
}

// 映射物流公司到商城ID
function mapExpressToMallId(expressName) {
  return EXPRESS_MAPPING[expressName] || null;
}

// 回传物流信息到商城
async function updateMallLogistics(token, orderId, expressId, expressNo) {
  const response = await axios.post(
    `${MALL_BASE_URL}/merchant-backend-pc/merchant/do-order-shipping`,
    {
      order_id: orderId,
      expect_code: 'self_old_express',
      extra: {
        express_name: expressId,
        express_no: expressNo,
        reply: ''
      }
    },
    {
      headers: { authorization: token }
    }
  );

  return response.data;
}

// 主函数
(async () => {
  if (process.argv.length < 3) {
    console.log('用法: node sync_logistics.js <商城订单号>');
    process.exit(1);
  }

  const orderId = process.argv[2];

  console.log(`📦 开始同步订单物流: ${orderId}\n`);

  // 1. 从仓库查询物流信息
  console.log('🔍 查询仓库发货单...');
  const delivery = await getDeliveryFromWarehouse(orderId);

  if (!delivery) {
    console.log('❌ 未找到发货单');
    process.exit(1);
  }

  console.log(`✅ 物流公司: ${delivery.expressName}`);
  console.log(`✅ 物流单号: ${delivery.expressNo}\n`);

  // 2. 映射物流公司
  const expressId = mapExpressToMallId(delivery.expressName);
  if (!expressId) {
    console.log(`❌ 无法映射物流公司: ${delivery.expressName}`);
    process.exit(1);
  }

  console.log(`✅ 商城物流ID: ${expressId}\n`);

  // 3. 登录商城
  console.log('🔐 登录商城...');
  const token = await mallLogin();
  console.log('✅ 登录成功\n');

  // 4. 回传物流信息
  console.log('📤 回传物流信息...');
  const result = await updateMallLogistics(token, orderId, expressId, delivery.expressNo);

  if (result.code === 0) {
    console.log('✅ 物流信息回传成功!');
  } else {
    console.log(`❌ 回传失败: ${result.message}`);
  }
})();

