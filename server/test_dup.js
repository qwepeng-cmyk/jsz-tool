const { callApi } = require('../erp-api.js');

(async () => {
    console.log("Searching for platform code: gopx202603291211392953");
    let res = await callApi('gy.erp.trade.get', { platform_code: 'gopx202603291211392953' });
    console.log("gy.erp.trade.get res:", JSON.stringify(res, null, 2));

    console.log("\nAttempting to create it again just to see the exact error...");
    try {
        const orderData = require('../order_to_upload.json');
        let addRes = await callApi('gy.erp.trade.add', orderData);
        console.log("gy.erp.trade.add res:", JSON.stringify(addRes, null, 2));
    } catch (e) {
        console.log("failed loading json:", e.message);
    }
})();
