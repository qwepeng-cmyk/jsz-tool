const { spawnSync } = require('child_process');
const fs = require('fs');

const orderId = 'gopx202603291211392953';
console.log(`Testing full upload flow for ${orderId}`);

// Run the python script to generate order_to_upload.json
const py = spawnSync('python3', ['upload_order.py', orderId], { cwd: '../' });
console.log('Python output:\n', py.stdout.toString(), py.stderr.toString());

// Read the JSON
if (fs.existsSync('../order_to_upload.json')) {
    const json = fs.readFileSync('../order_to_upload.json', 'utf8');
    console.log('Generated JSON for ERP:');
    console.log(json);
    
    // Test the JS side
    const js = spawnSync('node', ['upload_order.js'], { cwd: '../' });
    console.log('Node upload output:\n', js.stdout.toString(), js.stderr.toString());
} else {
    console.log("Python script failed to generate order_to_upload.json");
}
