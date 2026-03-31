const { callApi } = require('./erp-api.js');

(async () => {
    console.log("Searching for platform code: gopx202603291211392953");
    let res = await callApi('gy.erp.trade.get', { platform_code: 'gopx202603291211392953' });
    console.log(JSON.stringify(res, null, 2));
    
    // Check if it's returning a different error when adding
    console.log("\nAttempting to create it again just to see the exact errorDesc...");
    let dbData = require('./database.sqlite'); // This won't work easily, let's just use what's in order_to_upload.json if it's still there
    try {
        const orderData = require('../order_to_upload.json');
        let addRes = await callApi('gy.erp.trade.add', orderData);
        console.log(JSON.stringify(addRes, null, 2));
    } catch (e) {
        console.log("No order_to_upload.json or failed: ", e.message);
    }
})();
