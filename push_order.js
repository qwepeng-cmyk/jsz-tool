const { callApi, formatDate } = require('./erp-api.js');

(async () => {
  const orderData = {
    shop_code: "301535",
    order_type_code: "Sales",
    deal_datetime: "2026-03-24 23:52:00",
    platform_code: "gopx20260324235217295950",
    warehouse_code: "301535",
    vip_code: "13811146010",
    buyer_memo: "",
    receiver_name: "吾古力江",
    receiver_mobile: "13811146010",
    receiver_province: "北京市",
    receiver_city: "北京市",
    receiver_district: "朝阳区",
    receiver_address: "亚运村街道欧陆经典2号楼305",
    receiver_zip: "100020",
    details: [
      {
        item_code: "6976308020146",
        qty: "3",
        price: "23",
        platform_item_name: ""
      }
    ]
  };

  console.log('📤 推送订单:', orderData.platform_code);
  const result = await callApi('gy.erp.trade.add', orderData);

  console.log('\n返回结果:');
  console.log(JSON.stringify(result, null, 2));

  if (result && result.success) {
    console.log('\n✅ 订单推送成功');
  } else {
    console.log('\n❌ 订单推送失败');
  }
})();
