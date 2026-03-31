const axios = require('axios');
const crypto = require('crypto');

// ========== API 凭证 ==========
const APP_KEY = '195913';
const SECRET = '8cebd6dcf53d4bcd9efd79baf37e39b0';
const SESSION_KEY = '42dabd2137db4bcab2a02d7765ae84b6';
const API_URL = 'http://v2.api.guanyierp.com/rest/erp_open';

// ========== 工具函数 ==========
const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function generateSign(params) {
  const jsonStr = JSON.stringify(params);
  const signStr = SECRET + jsonStr + SECRET;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
}

// ========== 通用请求方法 ==========
async function callApi(method, extraParams = {}) {
  const params = {
    appkey: APP_KEY,
    sessionkey: SESSION_KEY,
    method: method,
    ...extraParams,
  };

  const sign = generateSign(params);
  params.sign = sign;

  console.log(`\n🚀 调用接口: ${method}`);

  try {
    const response = await axios.post(
      API_URL,
      encodeURIComponent(JSON.stringify(params)),
      {
        headers: { 'Content-Type': 'text/json; charset=UTF-8' },
        timeout: 30000,
      }
    );

    const data = response.data;
    if (data.success) {
      console.log('✅ 调用成功');
    } else {
      console.log('❌ 调用失败');
      console.log('   错误代码:', data.errorCode);
      console.log('   错误描述:', data.errorDesc);
      if (data.subErrorCode) console.log('   子错误代码:', data.subErrorCode);
      if (data.subErrorDesc) console.log('   子错误描述:', data.subErrorDesc);
    }
    return data;
  } catch (error) {
    console.error('❌ 请求异常:', error.message);
    return null;
  }
}

// =============================================
//  1. 查询订单列表  gy.erp.trade.get
//     返回精简信息（单号、时间等）
//     ⚠️ 时间跨度限制: 不超过24小时
// =============================================
async function queryOrders(options = {}) {
  const params = {
    page_no: String(options.page_no || 1),
    page_size: String(options.page_size || 10),
  };

  if (options.start_date) params.start_date = options.start_date;
  if (options.end_date) params.end_date = options.end_date;
  if (options.date_type !== undefined) params.date_type = String(options.date_type);
  if (options.order_state !== undefined) params.order_state = String(options.order_state);
  if (options.shop_code) params.shop_code = options.shop_code;
  if (options.warehouse_code) params.warehouse_code = options.warehouse_code;
  if (options.platform_code) params.platform_code = options.platform_code;
  if (options.code) params.code = options.code;
  if (options.vip_name) params.vip_name = options.vip_name;
  if (options.receiver_mobile) params.receiver_mobile = options.receiver_mobile;

  const result = await callApi('gy.erp.trade.get', params);

  if (result && result.success) {
    const total = result.total || 0;
    const orders = result.orders || [];
    console.log(`📋 共 ${total} 条订单, 当前返回 ${orders.length} 条`);

    orders.forEach((order, i) => {
      console.log(`\n  📦 订单 ${i + 1}:`);
      console.log(`     单据编号: ${order.code || 'N/A'}`);
      console.log(`     创建时间: ${order.createtime || 'N/A'}`);
      console.log(`     拍单时间: ${order.dealtime || 'N/A'}`);
      console.log(`     付款时间: ${order.paytime || 'N/A'}`);
    });

    if (orders.length > 0 && process.env.DEBUG) {
      console.log('\n🔍 第一条订单完整数据:');
      console.log(JSON.stringify(orders[0], null, 2));
    }
  }

  return result;
}

// =============================================
//  2. 查询订单详情  gy.erp.trade.history.get
//     返回完整信息（店铺、仓库、收件人、商品明细等）
//     ⚠️ 时间跨度限制: 不超过24小时
// =============================================
async function queryOrderHistory(options = {}) {
  const params = {
    page_no: String(options.page_no || 1),
    page_size: String(options.page_size || 10),
  };

  if (options.start_date) params.start_date = options.start_date;
  if (options.end_date) params.end_date = options.end_date;
  if (options.date_type !== undefined) params.date_type = String(options.date_type);
  if (options.order_state !== undefined) params.order_state = String(options.order_state);
  if (options.shop_code) params.shop_code = options.shop_code;
  if (options.warehouse_code) params.warehouse_code = options.warehouse_code;
  if (options.platform_code) params.platform_code = options.platform_code;
  if (options.code) params.code = options.code;
  if (options.vip_name) params.vip_name = options.vip_name;
  if (options.receiver_mobile) params.receiver_mobile = options.receiver_mobile;
  if (options.has_cancel_data !== undefined) params.has_cancel_data = options.has_cancel_data;

  const result = await callApi('gy.erp.trade.history.get', params);

  if (result && result.success) {
    const total = result.total || 0;
    const orders = result.orders || [];
    console.log(`📋 共 ${total} 条订单详情, 当前返回 ${orders.length} 条`);

    orders.forEach((order, i) => {
      console.log(`\n  📦 订单详情 ${i + 1}:`);
      console.log(`     单据编号: ${order.code || 'N/A'}`);
      console.log(`     平台单号: ${order.outer_code || order.platform_code || 'N/A'}`);
      console.log(`     店铺: ${order.shop_name || order.shop_code || 'N/A'}`);
      console.log(`     仓库: ${order.warehouse_name || order.warehouse_code || 'N/A'}`);
      console.log(`     会员: ${order.vip_name || order.vip_code || 'N/A'}`);
      console.log(`     收件人: ${order.receiver_name || 'N/A'}`);
      console.log(`     手机: ${order.receiver_mobile || 'N/A'}`);
      console.log(`     地址: ${(order.receiver_province || '') + (order.receiver_city || '') + (order.receiver_district || '') + (order.receiver_address || '') || 'N/A'}`);
      console.log(`     金额: ${order.amount || order.payment || 'N/A'}`);
      console.log(`     订单类型: ${order.order_type_name || order.order_type_code || 'N/A'}`);
      console.log(`     状态: ${order.order_state_name || order.order_state || 'N/A'}`);
      console.log(`     创建时间: ${order.createtime || order.create_date || 'N/A'}`);
      console.log(`     拍单时间: ${order.dealtime || order.deal_datetime || 'N/A'}`);
      console.log(`     付款时间: ${order.paytime || order.pay_date || 'N/A'}`);
      console.log(`     卖家备注: ${order.seller_memo || 'N/A'}`);
      console.log(`     买家留言: ${order.buyer_memo || 'N/A'}`);

      // 显示商品明细
      const details = order.details || [];
      if (details.length > 0) {
        console.log(`     商品明细 (${details.length} 项):`);
        details.forEach((d, j) => {
          console.log(`       ${j + 1}. ${d.item_name || d.item_code || 'N/A'} x${d.qty || 'N/A'} @ ¥${d.price || 'N/A'}`);
        });
      }
    });

    if (orders.length > 0 && process.env.DEBUG) {
      console.log('\n🔍 第一条订单完整数据:');
      console.log(JSON.stringify(orders[0], null, 2));
    }
  }

  return result;
}

// =============================================
//  3. 查询发货单  gy.erp.trade.deliverys.get
//     返回发货单信息（物流单号、发货状态等）
// =============================================
async function queryDeliverys(options = {}) {
  const params = {
    page_no: String(options.page_no || 1),
    page_size: String(options.page_size || 10),
  };

  if (options.start_create) params.start_create = options.start_create;
  if (options.end_create) params.end_create = options.end_create;
  if (options.start_delivery_date) params.start_delivery_date = options.start_delivery_date;
  if (options.end_delivery_date) params.end_delivery_date = options.end_delivery_date;
  if (options.code) params.code = options.code;
  if (options.outer_code) params.outer_code = options.outer_code;
  if (options.shop_code) params.shop_code = options.shop_code;
  if (options.warehouse_code) params.warehouse_code = options.warehouse_code;
  if (options.delivery !== undefined) params.delivery = String(options.delivery);
  if (options.mail_no) params.mail_no = options.mail_no;

  const result = await callApi('gy.erp.trade.deliverys.get', params);

  if (result && result.success) {
    const total = result.total || 0;
    const deliverys = result.deliverys || [];
    console.log(`📋 共 ${total} 条发货单, 当前返回 ${deliverys.length} 条`);

    deliverys.forEach((d, i) => {
      console.log(`\n  🚚 发货单 ${i + 1}:`);
      console.log(`     单据编号: ${d.code || 'N/A'}`);
      console.log(`     平台单号: ${d.outer_code || d.platform_code || 'N/A'}`);
      console.log(`     店铺: ${d.shop_name || d.shop_code || 'N/A'}`);
      console.log(`     仓库: ${d.warehouse_name || d.warehouse_code || 'N/A'}`);
      console.log(`     物流单号: ${d.mail_no || 'N/A'}`);
      console.log(`     发货状态: ${d.delivery === 1 || d.delivery === '1' ? '已发货' : '未发货'}`);
      console.log(`     金额: ${d.amount || 'N/A'}`);
      console.log(`     商品数: ${d.qty || 'N/A'}`);
    });

    if (deliverys.length > 0 && process.env.DEBUG) {
      console.log('\n🔍 第一条发货单完整数据:');
      console.log(JSON.stringify(deliverys[0], null, 2));
    }
  }

  return result;
}

// =============================================
//  4. 写入/新增订单  gy.erp.trade.add
// =============================================
/**
 * 新增订单
 * 
 * 必填字段:
 *   shop_code         - 店铺代码
 *   warehouse_code    - 仓库代码
 *   vip_code          - 会员代码
 *   express_code      - 物流公司代码
 *   deal_datetime     - 拍单时间 (如 "2026-03-27 16:00:00")
 *   order_type_code   - 订单类型: Sales/Return/Charge/Delivery/Invoice
 *   receiver_name     - 收货人
 *   receiver_mobile   - 手机号码
 *   receiver_province - 省
 *   receiver_city     - 市
 *   receiver_district - 区
 *   receiver_address  - 详细地址
 *   details[]         - 商品明细数组
 *     item_code       - 商品代码 (必填)
 *     qty             - 数量 (必填, 建议字符串)
 *     price           - 实际单价 (必填, 建议字符串)
 *     sku_code        - 规格代码 (可选)
 *
 * 可选字段:
 *   platform_code, seller_memo, buyer_memo, post_fee, cod, plan_delivery_date 等
 */
async function createOrder(orderData) {
  const requiredFields = [
    'shop_code', 'warehouse_code', 'vip_code', 'express_code',
    'deal_datetime', 'order_type_code',
    'receiver_name', 'receiver_mobile',
    'receiver_province', 'receiver_city', 'receiver_district', 'receiver_address',
    'details',
  ];

  const missing = requiredFields.filter(f => !orderData[f]);
  if (missing.length > 0) {
    console.error('❌ 缺少必填字段:', missing.join(', '));
    return null;
  }

  if (!Array.isArray(orderData.details) || orderData.details.length === 0) {
    console.error('❌ 商品明细 details 不能为空');
    return null;
  }

  for (let i = 0; i < orderData.details.length; i++) {
    const d = orderData.details[i];
    if (!d.item_code || !d.qty || !d.price) {
      console.error(`❌ 商品明细第 ${i + 1} 项缺少必填字段 (item_code/qty/price)`);
      return null;
    }
  }

  console.log('\n📝 准备创建订单:');
  console.log('   店铺:', orderData.shop_code);
  console.log('   仓库:', orderData.warehouse_code);
  console.log('   类型:', orderData.order_type_code);
  console.log('   收件人:', orderData.receiver_name, orderData.receiver_mobile);
  console.log('   地址:', orderData.receiver_province + orderData.receiver_city + orderData.receiver_district + orderData.receiver_address);
  console.log('   商品:', orderData.details.length, '项');
  orderData.details.forEach((d, i) => {
    console.log(`     ${i + 1}. ${d.item_code} x${d.qty} @ ¥${d.price}`);
  });

  const result = await callApi('gy.erp.trade.add', orderData);

  if (result && result.success) {
    console.log('🎉 订单创建成功！');
    if (result.code) console.log('   订单编号:', result.code);
    if (result.platform_code) console.log('   平台单号:', result.platform_code);
  }

  return result;
}

// =============================================
//  5. 自动翻页查询所有订单
// =============================================
async function queryAllOrders(options = {}, methodFn = queryOrders) {
  const pageSize = options.page_size || 50;
  let pageNo = 1;
  let allOrders = [];
  let total = 0;

  console.log('\n📋 开始查询所有订单（自动翻页）...');

  do {
    const result = await methodFn({
      ...options,
      page_no: pageNo,
      page_size: pageSize,
    });

    if (!result || !result.success) {
      console.log('❌ 翻页查询在第', pageNo, '页失败');
      break;
    }

    total = result.total || 0;
    const orders = result.orders || [];
    allOrders = allOrders.concat(orders);
    console.log(`   第 ${pageNo} 页: 获取 ${orders.length} 条, 累计 ${allOrders.length}/${total}`);

    if (allOrders.length >= total || orders.length === 0) break;
    pageNo++;

    if (pageNo > 100) {
      console.log('⚠️ 超过100页，停止翻页');
      break;
    }
  } while (true);

  console.log(`\n✅ 查询完成, 总共获取 ${allOrders.length} 条订单`);
  return allOrders;
}

// =============================================
//  6. 查询订单详情  gy.erp.trade.detail.get
//     【黄金接口】返回最细致的物流单号 (express_no)
// =============================================
async function queryOrderDetail(options = {}) {
  const params = {};
  if (options.code) params.code = options.code;
  
  const result = await callApi('gy.erp.trade.detail.get', params);
  
  if (result && result.success && result.orderDetail) {
    const d = result.orderDetail;
    console.log(`\n✅ 抓取到详情: ${d.code}`);
    console.log(`   物流公司: ${d.express_name || 'N/A'}`);
    console.log(`   物流单号: ${d.express_no || 'N/A'}`);
  }
  
  return result;
}

// =============================================
//  7. 查询发货包裹明细  gy.erp.delivery.package.order.get
// =============================================
async function queryPackageDetail(options = {}) {
  const params = {};
  if (options.code) params.code = options.code;
  
  const result = await callApi('gy.erp.delivery.package.order.get', params);
  
  if (result && result.success && result.details && result.details.length > 0) {
    console.log(`\n📦 抓取到包裹明细! 数量: ${result.details.length}`);
  }
  
  return result;
}

// =============================================
//  导出模块
// =============================================
module.exports = {
  callApi,
  queryOrders,
  queryOrderHistory,
  queryDeliverys,
  queryAllOrders,
  queryOrderDetail,
  queryPackageDetail,
  createOrder,
  generateSign,
  formatDate,
};

// =============================================
//  命令行运行
// =============================================
if (require.main === module) {
  (async () => {
    const action = process.argv[2] || 'help';

    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const startDate = formatDate(oneDayAgo);
    const endDate = formatDate(now);

    switch (action) {
      case 'query':
        // 查询最近24小时订单列表（精简）
        console.log('🔍 查询最近24小时的订单列表...');
        console.log(`   时间范围: ${startDate} ~ ${endDate}`);
        await queryOrders({
          start_date: startDate,
          end_date: endDate,
          date_type: 0,
          page_no: 1,
          page_size: 10,
        });
        break;

      case 'detail':
        // 查询最近24小时订单详情（完整信息）
        console.log('🔍 查询最近24小时的订单详情...');
        console.log(`   时间范围: ${startDate} ~ ${endDate}`);
        await queryOrderHistory({
          start_date: startDate,
          end_date: endDate,
          date_type: 0,
          page_no: 1,
          page_size: 5,
        });
        break;

      case 'delivery':
        // 查询最近24小时发货单
        console.log('🔍 查询最近24小时的发货单...');
        await queryDeliverys({
          start_create: startDate,
          end_create: endDate,
          page_no: 1,
          page_size: 5,
        });
        break;

      case 'create':
        // 创建订单示例
        console.log('⚠️  创建订单示例（未实际执行）\n');
        const sampleOrder = {
          shop_code: '23289',
          warehouse_code: '23289',
          vip_code: 'VIP001',
          express_code: 'SF',
          deal_datetime: formatDate(now),
          order_type_code: 'Sales',
          receiver_name: '张三',
          receiver_mobile: '13800138000',
          receiver_province: '广东省',
          receiver_city: '深圳市',
          receiver_district: '南山区',
          receiver_address: 'XX路XX号',
          seller_memo: '测试订单',
          details: [
            { item_code: 'SP001', qty: '1', price: '99.00' },
          ],
        };
        console.log('📝 示例订单数据:');
        console.log(JSON.stringify(sampleOrder, null, 2));
        console.log('\n💡 要实际创建，取消 erp-api.js 最后的注释');
        // await createOrder(sampleOrder);
        break;

      default:
        console.log('管易云ERP API 工具');
        console.log('==========================================');
        console.log('用法: node erp-api.js <命令>\n');
        console.log('命令:');
        console.log('  query      查询最近24小时订单列表（精简信息）');
        console.log('  detail     查询最近24小时订单详情（完整信息: 店铺/收件人/商品等）');
        console.log('  delivery   查询最近24小时发货单');
        console.log('  create     显示创建订单示例');
        console.log('  help       显示帮助信息');
        console.log('\n提示:');
        console.log('  设置 DEBUG=1 可查看接口返回的完整 JSON 数据');
        console.log('  例: DEBUG=1 node erp-api.js detail');
        break;
    }
  })();
}
