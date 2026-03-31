const { callApi } = require('./erp-api.js');

(async () => {
  const orderId = 'gopx20260329121139295321';
  const result = await callApi('gy.erp.trade.history.get', { platform_code: orderId });
  if (result && result.orders && result.orders.length > 0) {
    console.log(JSON.stringify(result.orders[0], null, 2));
  }
})();
