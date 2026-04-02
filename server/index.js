const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const db = require('./db');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'jiangshouzuo_secret_v1';
const users = {
  admin: 'jsz1qaz',
  jsz01: 'jsz1qaz',
  jsz02: 'jsz1qaz'
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, username });
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

const authenticateToken = (req, res, next) => {
  if (req.path === '/api/auth/login') return next();
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (token == null) return res.status(401).json({ message: '未授权' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token 已过期或无效' });
    req.user = user;
    next();
  });
};

app.use('/api', authenticateToken);

app.get('/api/orders', (req, res) => {
  const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
  const orders = stmt.all().map(o => ({
    ...o,
    order_data: JSON.parse(o.order_data || '{}')
  }));
  res.json({ success: true, data: orders });
});

app.get('/api/mappings', (req, res) => {
  const mappings = db.prepare('SELECT * FROM product_mappings').all();
  res.json({ success: true, data: mappings });
});

app.post('/api/mappings', (req, res) => {
  const { keyword, item_code, item_name } = req.body;
  try {
    db.prepare('INSERT INTO product_mappings (keyword, item_code, item_name) VALUES (?, ?, ?)').run(keyword, item_code, item_name);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: '关键字已存在或输入有误' });
  }
});

app.put('/api/mappings/:id', (req, res) => {
  const { keyword, item_code, item_name } = req.body;
  const { id } = req.params;
  try {
    db.prepare('UPDATE product_mappings SET keyword=?, item_code=?, item_name=? WHERE id=?').run(keyword, item_code, item_name, id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

app.delete('/api/mappings/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM product_mappings WHERE id=?').run(id);
  res.json({ success: true });
});

const sendSSE = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// ======= 日志与配置工具 =======
const logSync = (type, status, summary, details = '', trigger = 'MANUAL') => {
  try {
    db.prepare('INSERT INTO sync_logs (type, status, summary, details, trigger_type, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\', \'localtime\'))')
      .run(type, status, summary, details, trigger);
    // 自动清理30天前的日志
    db.prepare("DELETE FROM sync_logs WHERE created_at < datetime('now', '-30 days')").run();
  } catch (e) {
    console.error('Failed to log sync:', e);
  }
};

let cronJobs = [];

const setupCronJobs = () => {
  // 先停止旧任务
  cronJobs.forEach(job => job.stop());
  cronJobs = [];

  const config = db.prepare('SELECT * FROM system_config').all();
  const isAutoEnabled = config.find(c => c.key === 'auto_sync_enabled')?.value === '1';

  if (!isAutoEnabled) {
    console.log('⏰ 自动同步已禁用');
    return;
  }

  const orderSyncTimes = (config.find(c => c.key === 'cron_hours_order_sync')?.value || '11,15').split(',');
  const logisticsSyncTimes = (config.find(c => c.key === 'cron_hours_logistics_sync')?.value || '17').split(',');

  // 订单同步任务 (Scrape + Auto Push)
  orderSyncTimes.forEach(time => {
    let hour = '0', minute = '0';
    if (time.includes(':')) {
      [hour, minute] = time.trim().split(':');
    } else {
      hour = time.trim();
    }

    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);

    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      console.warn(`⏰ [WARN] 非法时间格式: "${time}", 已跳过`);
      return;
    }

    try {
      const cronStr = `${m} ${h} * * *`;
      const taskOrder = cron.schedule(cronStr, async () => {
        console.log(`[Cron Task] ========================================`);
        console.log(`[Cron Task] 开始执行订单同步 (${new Date().toLocaleString()}) - 设定点: ${time}`);
        try {
          const scrapeResult = await internalTaskScrape(null, 'AUTOMATIC');
          if (scrapeResult.success) {
            const unsynced = db.prepare(`
              SELECT order_id FROM orders 
              WHERE status_warehouse = 0 
              AND json_extract(order_data, '$.订单状态') = '待发货'
              ORDER BY json_extract(order_data, '$.创建时间') ASC
            `).all().map(r => r.order_id);

            if (unsynced.length > 0) {
              await internalTaskSyncWarehouse(unsynced, null, 'AUTOMATIC');
            }
          }
        } catch (e) {
          console.error(`[Cron Task] 订单同步执行出错: ${e.message}`);
        }
        console.log(`[Cron Task] 订单同步流程结束`);
        console.log(`[Cron Task] ========================================`);
      });
      cronJobs.push(taskOrder);
      console.log(`⏰ [SUCCESS] 订单同步任务已挂载: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    } catch (err) {
      console.error(`⏰ [ERROR] 挂载订单同步任务失败 (${time}): ${err.message}`);
    }
  });

  // 物流回传任务
  logisticsSyncTimes.forEach(time => {
    let hour = '0', minute = '0';
    if (time.includes(':')) {
      [hour, minute] = time.trim().split(':');
    } else {
      hour = time.trim();
    }

    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);

    if (!isNaN(h) && !isNaN(m)) {
      const cronStr = `${m} ${h} * * *`;
      const taskLogistics = cron.schedule(cronStr, async () => {
        console.log(`[Cron Task] ========================================`);
        console.log(`[Cron Task] 开始执行物流同步 (${new Date().toLocaleString()}) - 设定点: ${time}`);
        const toCheck = db.prepare(`
                    SELECT order_id FROM orders 
                    WHERE status_warehouse = 1 AND status_logistics = 0 
                      AND (express_no IS NULL OR express_no = '')
                    ORDER BY json_extract(order_data, '$.创建时间') ASC
                `).all().map(r => r.order_id);

        if (toCheck.length > 0) {
          await internalTaskCheckLogistics(toCheck, null, 'AUTOMATIC');
        }

        const toSync = db.prepare(`
                    SELECT order_id FROM orders 
                    WHERE status_warehouse = 1 AND status_logistics = 0 
                      AND (express_no IS NOT NULL AND express_no != '')
                    ORDER BY json_extract(order_data, '$.创建时间') ASC
                `).all().map(r => r.order_id);

        if (toSync.length > 0) {
          await internalTaskSyncLogistics(toSync, null, 'AUTOMATIC');
        }
        console.log(`[Cron Task] 物流回传流程结束`);
        console.log(`[Cron Task] ========================================`);
      });
      cronJobs.push(taskLogistics);
      console.log(`⏰ [SET] 物流回传已载入: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (每 24h 执行)`);
    }
  });

  logSync('SYSTEM', 'INFO', `系统定时任务已更新，共载入 ${cronJobs.length} 个同步任务`, `订单同步: ${orderSyncTimes.join(', ')}; 物流回传: ${logisticsSyncTimes.join(', ')}`, 'SYSTEM');

  console.log(`⏰ 自动同步已就绪，共维护 ${cronJobs.length} 个定时触发点`);
};

// ======= 核心任务提取 =======

async function internalTaskScrape(sseRes = null, trigger = 'MANUAL') {
  let scrapeLog = "";
  process.stdout.write(`[ScrapeTask] 开始爬取订单过程... (${new Date().toLocaleString()})\n`);

  const result = await new Promise((resolve) => {
    const cp = spawn('python3', ['-u', 'scrape_orders.py'], { cwd: path.resolve(__dirname, '..') });
    cp.stdout.on('data', data => {
      const text = data.toString();
      scrapeLog += text;
      if (sseRes) sendSSE(sseRes, { type: 'progress', message: text.trim(), progress: 30 });
    });
    cp.on('close', code => resolve({ success: code === 0, log: scrapeLog }));
  });

  let s_new = 0;
  let s_existing = 0;
  const newMatches = [...result.log.matchAll(/新增 (\d+) 笔/g)];
  const updateMatches = [...result.log.matchAll(/更新 (\d+) 笔/g)];

  newMatches.forEach(m => s_new += parseInt(m[1], 10));
  updateMatches.forEach(m => s_existing += parseInt(m[1], 10));

  const summary = result.success
    ? `抓取完成: 新增 ${s_new} 笔, 存量核验 ${s_existing} 笔, 失败 0 笔`
    : "商城订单同步失败";

  logSync('SCRAPE', result.success ? 'SUCCESS' : 'FAIL', summary, result.log, trigger);
  return result;
}

// ======= 核验仓库状态：去 ERP 查平台单号是否存在 =======
const { queryOrders, queryOrderDetail, queryPackageDetail, queryOrderHistory } = require('../erp-api.js');

app.get('/api/orders/verify-warehouse', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const allToVerify = db.prepare(`
    SELECT order_id, platform_code, status_warehouse FROM orders 
    WHERE json_extract(order_data, '$.订单状态') = '待发货'
       OR status_warehouse = 1
  `).all();

  if (allToVerify.length === 0) {
    sendSSE(res, { type: 'complete', message: '当前没有待发货订单或同步订单需要核验。', progress: 100 });
    return res.end();
  }

  sendSSE(res, { type: 'progress', message: `开始严格核验 ${allToVerify.length} 笔订单的对应仓库状态...`, progress: 0 });

  let correctedSynced = 0;
  let correctedUnsynced = 0;

  for (let i = 0; i < allToVerify.length; i++) {
    const order = allToVerify[i];
    const platformCode = order.platform_code || order.order_id;
    const baseP = Math.floor(((i + 1) / allToVerify.length) * 100);

    try {
      // 用平台单号去 ERP 查询
      const result = await queryOrders({ platform_code: platformCode, page_size: 1 });

      if (result && result.success && result.orders && result.orders.length > 0) {
        // ERP 里存在
        if (!order.status_warehouse) {
          db.prepare('UPDATE orders SET status_warehouse = 1 WHERE order_id = ?').run(order.order_id);
          correctedSynced++;
        }
        sendSSE(res, { type: 'progress', message: `✅ [${i + 1}/${allToVerify.length}] ${platformCode} → 仓库已存在`, progress: baseP });
      } else {
        // ERP 里不存在
        if (order.status_warehouse) {
          db.prepare('UPDATE orders SET status_warehouse = 0 WHERE order_id = ?').run(order.order_id);
          correctedUnsynced++;
        }
        sendSSE(res, { type: 'progress', message: `⏳ [${i + 1}/${allToVerify.length}] ${platformCode} → 仓库未找到`, progress: baseP });
      }
    } catch (err) {
      sendSSE(res, { type: 'progress', message: `⚠️ [${i + 1}/${allToVerify.length}] ${platformCode} → 查询出错: ${err.message || err}`, progress: baseP });
    }
  }

  sendSSE(res, { type: 'complete', message: `核验完成！\n系统更新了 ${correctedSynced} 笔单子为已同步；\n并纠错还原了 ${correctedUnsynced} 笔为未同步。`, progress: 100 });
  res.end();
});



// ======= 触发原版爬虫 =======
app.get('/api/orders/scrape', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  await internalTaskScrape(res);
  sendSSE(res, { type: 'complete', message: `爬虫执行完毕`, progress: 100 });
  res.end();
});

async function internalTaskSyncWarehouse(orderIds, sseRes = null, trigger = 'MANUAL') {
  const log = (msg, progress = 50) => {
    if (sseRes) sendSSE(sseRes, { type: 'progress', message: msg, progress });
    console.log(`[Warehouse] ${msg}`);
  };

  const total = orderIds.length;
  let s_new = 0;
  let s_duplicate = 0;
  let s_fail = 0;
  let detailsLog = "";

  for (let i = 0; i < total; i++) {
    const oid = orderIds[i];
    const baseP = Math.floor((i / total) * 100);
    log(`[${i + 1}/${total}] 开始处理订单 ${oid}`, baseP);

    const row = db.prepare('SELECT status_warehouse FROM orders WHERE order_id = ?').get(oid);
    if (row && row.status_warehouse) {
      log(`订单 ${oid} 已标记为同步，跳过。`, baseP + 10);
      s_duplicate++;
      continue;
    }

    try {
      // Step 1: Python build JSON
      await new Promise((resolve, reject) => {
        const py = spawn('python3', ['-u', 'upload_order.py', oid], { cwd: path.resolve(__dirname, '..') });
        py.stdout.on('data', data => {
          const text = data.toString();
          if (text.trim()) log(text.trim(), baseP + 2);
          detailsLog += `[${oid}] ${text}`;
        });
        py.on('close', code => {
          if (code === 0) resolve();
          else reject(`Python 解析失败`);
        });
      });

      // Step 2: JS push ERP
      await new Promise((resolve, reject) => {
        const nd = spawn('node', ['upload_order.js'], { cwd: path.resolve(__dirname, '..') });
        let isDuplicate = false;
        let isSuccess = false;
        nd.stdout.on('data', data => {
          const text = data.toString();
          detailsLog += `[${oid}] ${text}`;
          text.split('\n').forEach(l => {
            if (l.trim()) log(l.trim(), baseP + 5);
          });
          if (text.includes('不允许重复上传')) isDuplicate = true;
          if (text.includes('订单推送成功')) isSuccess = true;
          if (isSuccess || isDuplicate) {
            db.prepare('UPDATE orders SET status_warehouse = 1 WHERE order_id = ?').run(oid);
          }
        });
        nd.on('close', code => {
          if (code === 0 || isDuplicate) {
            if (isSuccess) s_new++;
            else s_duplicate++;
            resolve();
          } else {
            reject(`Node ERP 推送失败`);
          }
        });
      });
    } catch (err) {
      log(`❌ 订单 ${oid} 失败: ${err}`, baseP);
      s_fail++;
      detailsLog += `[${oid}] Error: ${err}\n`;
    }
  }

  const summary = `同步完成: 成功 ${s_new} 笔, 仓库已存在 ${s_duplicate} 笔, 失败 ${s_fail} 笔`;
  const status = s_fail === 0 ? 'SUCCESS' : (s_new > 0 ? 'PARTIAL' : 'FAIL');
  logSync('WAREHOUSE', status, summary, detailsLog, trigger);
  return { s_new, s_duplicate, s_fail };
}

// ======= 触发原版上传 (批量) =======
app.get('/api/orders/sync-warehouse', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const orderIds = req.query.ids ? req.query.ids.split(',') : [];
  if (orderIds.length === 0) {
    sendSSE(res, { type: 'error', message: '没有提供同步的订单号' });
    return res.end();
  }

  // 预排序：确保传入的 ID 按照订单创建时间先后顺序执行同步
  let finalIds = orderIds;
  try {
    if (orderIds.length > 1) {
      const sortedRows = db.prepare(`
              SELECT order_id FROM orders 
              WHERE order_id IN (${orderIds.map(() => '?').join(',')}) 
              ORDER BY json_extract(order_data, '$.创建时间') ASC
          `).all(orderIds);
      finalIds = sortedRows.map(r => r.order_id);
    }
  } catch (e) {
    console.error('Failed to sort order sequence, fallback to default:', e);
  }

  const result = await internalTaskSyncWarehouse(finalIds, res);
  sendSSE(res, {
    type: 'complete',
    message: `处理完成！\n✅ 新增推送成功: ${result.s_new} 笔\n♻️ 仓库已有记录: ${result.s_duplicate} 笔`,
    progress: 100
  });
  res.end();
});

// ======= 手动关联仓库单号 =======
app.post('/api/orders/bind-warehouse', async (req, res) => {
  const { order_id, platform_code } = req.body;
  if (!order_id || !platform_code) {
    return res.status(400).json({ success: false, message: '参数缺失' });
  }

  try {
    // 验证单号在 ERP 中是否存在
    const result = await queryOrderDetail({ code: platform_code });
    if (result && result.success) {
      db.prepare('UPDATE orders SET platform_code = ?, status_warehouse = 1 WHERE order_id = ?').run(platform_code, order_id);
      res.json({ success: true, message: '关联成功' });
    } else {
      res.status(404).json({ success: false, message: '在仓库中找不到该单据编号，请检查是否输入正确。' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

async function internalTaskCheckLogistics(ids, sseRes = null, trigger = 'MANUAL') {
  const log = (msg, progress = 50) => {
    if (sseRes) sendSSE(sseRes, { type: 'progress', message: msg, progress });
    console.log(`[CheckLogistics] ${msg}`);
  };

  let foundCount = 0;
  let detailsLog = "";
  for (let i = 0; i < ids.length; i++) {
    const oid = ids[i];
    const baseP = Math.floor(((i + 1) / ids.length) * 100);
    try {
      const localRow = db.prepare('SELECT platform_code FROM orders WHERE order_id = ?').get(oid);
      let searchKey = localRow ? localRow.platform_code : oid;
      log(`🕵️ 正在钻取单据 ${oid} ...`, baseP);
      let erpCode = null;
      let expressNo = null;
      let shippingName = null;

      if (searchKey.startsWith('SDO')) {
        erpCode = searchKey;
      } else {
        const listResult = await queryOrders({ platform_code: searchKey, page_size: 1 });
        if (listResult && listResult.success && listResult.orders && listResult.orders.length > 0) {
          erpCode = listResult.orders[0].code;
          expressNo = listResult.orders[0].express_no || listResult.orders[0].mail_no;
          shippingName = listResult.orders[0].express_name;
        } else {
          const historyResult = await queryOrderHistory({ platform_code: searchKey, page_size: 1 });
          if (historyResult && historyResult.success && historyResult.orders && historyResult.orders.length > 0) {
            erpCode = historyResult.orders[0].code;
            expressNo = historyResult.orders[0].express_no || historyResult.orders[0].mail_no || historyResult.orders[0].deliverys?.[0]?.mail_no;
            shippingName = historyResult.orders[0].express_name || historyResult.orders[0].deliverys?.[0]?.express_name;
          }
        }
      }
      if (erpCode && !expressNo) {
        const detailResult = await queryOrderDetail({ code: erpCode });
        if (detailResult && detailResult.success && detailResult.orderDetail) {
          const d = detailResult.orderDetail;
          expressNo = d.express_no || (d.deliverys?.[0]?.mail_no);
          shippingName = d.express_name || (d.deliverys?.[0]?.express_name);
        }
      }
      if (erpCode && !expressNo) {
        const pkgResult = await queryPackageDetail({ code: erpCode });
        if (pkgResult && pkgResult.success && pkgResult.details && pkgResult.details.length > 0) {
          expressNo = pkgResult.details[0].mail_no;
          shippingName = pkgResult.details[0].express_name;
        }
      }
      if (expressNo) {
        db.prepare('UPDATE orders SET express_no = ?, shipping_name = ? WHERE order_id = ?').run(expressNo, shippingName, oid);
        foundCount++;
        log(`✅ 订单 ${oid} 已抓取到单号: ${shippingName} (${expressNo})`, baseP);
        detailsLog += `[${oid}] 成功: ${expressNo}\n`;
      } else if (erpCode) {
        log(`⏳ 订单 ${oid} 仓库已接单(编号:${erpCode})，但单号尚未同步`, baseP);
        detailsLog += `[${oid}] 仓库已接单，无单号\n`;
      } else {
        log(`❓ 订单 ${oid} 暂无记录`, baseP);
        detailsLog += `[${oid}] 未找到记录\n`;
      }
    } catch (e) {
      log(`❌ 检查 ${oid} 出错: ${e.message}`, baseP);
      detailsLog += `[${oid}] Error: ${e.message}\n`;
    }
  }
  const summary = `核验完成！共抓取到 ${foundCount} 笔新物流单号`;
  logSync('CHECK_WAREHOUSE', 'SUCCESS', summary, detailsLog || '未发现新单号', trigger);
  return foundCount;
}

// ======= 检查仓库发货状态 (级联穿透模式) =======
app.get('/api/orders/check-logistics', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (ids.length === 0) {
    sendSSE(res, { type: 'complete', message: '没有选中需要检查的订单。', progress: 100 });
    return res.end();
  }

  const foundCount = await internalTaskCheckLogistics(ids, res);
  sendSSE(res, { type: 'complete', message: `检查完毕！共抓取到 ${foundCount} 笔新发货单号。`, progress: 100 });
  res.end();
});

async function internalTaskSyncLogistics(orderIds, sseRes = null, trigger = 'MANUAL') {
  const log = (msg, progress = 50) => {
    if (sseRes) sendSSE(sseRes, { type: 'progress', message: msg, progress });
    console.log(`[SyncLogistics] ${msg}`);
  };

  const total = orderIds.length;
  let s_count = 0;
  let detailsLog = "";

  for (let i = 0; i < total; i++) {
    const oid = orderIds[i];
    const baseP = Math.floor((i / total) * 100);
    const row = db.prepare('SELECT status_logistics, express_no, shipping_name FROM orders WHERE order_id = ?').get(oid);

    if (row && row.status_logistics) {
      detailsLog += `[${oid}] 已回传过，跳过\n`;
      continue;
    }
    if (!row || !row.express_no) {
      log(`⚠️ 订单 ${oid} 无单号，跳过`, baseP + 10);
      detailsLog += `[${oid}] 未匹配到发货单号，跳过\n`;
      continue;
    }

    try {
      log(`[${i + 1}/${total}] 正在同步至商城: ${oid}`, baseP);
      await new Promise((resolve) => {
        const pyArgs = [oid, String(row.shipping_name || ''), String(row.express_no || '')];
        const py = spawn('python3', ['-u', 'sync_logistics.py', ...pyArgs], { cwd: path.resolve(__dirname, '..') });
        py.stdout.on('data', data => {
          const text = data.toString();
          detailsLog += `[${oid}] ${text}`;
          text.split('\n').forEach(l => {
            if (!l.trim()) return;
            if (l.includes('订单配送记录已存在')) {
              log(`📋 提示: 订单 ${oid} 的单号在商城已存在`, baseP + 5);
            } else {
              log(l.trim(), baseP + 5);
            }
          });
          if (text.includes('回传成功') || text.includes('已回传') || text.includes('订单配送记录已存在')) {
            db.prepare('UPDATE orders SET status_logistics = 1 WHERE order_id = ?').run(oid);
            s_count++;
          }
        });
        py.on('close', () => resolve());
      });
    } catch (err) {
      log(`❌ 系统错误: ${err}`, baseP);
      detailsLog += `[${oid}] Error: ${err}\n`;
    }
  }
  const summary = s_count > 0 ? `回传完成！共确立 ${s_count} 笔` : `任务结束（当前无待回传项）`;
  logSync('LOGISTICS', 'SUCCESS', summary, detailsLog || '未发现符合回传条件的订单（需已推送到ERP且有单号）', trigger);
  return s_count;
}

// ======= 触发原版物流回传 (批量) =======
app.get('/api/orders/sync-logistics', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const orderIds = req.query.ids ? req.query.ids.split(',') : [];
  if (orderIds.length === 0) {
    sendSSE(res, { type: 'error', message: '没有提供需要回传的订单号' });
    return res.end();
  }

  const s_count = await internalTaskSyncLogistics(orderIds, res);
  sendSSE(res, { type: 'complete', message: `全量回传结束！共确立 ${s_count} 笔`, progress: 100 });
  res.end();
});

// ======= 系统配置与日志接口 =======
app.get('/api/config', (req, res) => {
  const config = db.prepare('SELECT * FROM system_config').all();
  const configObj = {};
  config.forEach(c => configObj[c.key] = c.value);
  res.json({ success: true, data: configObj });
});

app.post('/api/config', (req, res) => {
  const { cron_hours_order_sync, cron_hours_logistics_sync, auto_sync_enabled } = req.body;
  try {
    const upsert = db.prepare('INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    if (cron_hours_order_sync !== undefined) upsert.run('cron_hours_order_sync', String(cron_hours_order_sync));
    if (cron_hours_logistics_sync !== undefined) upsert.run('cron_hours_logistics_sync', String(cron_hours_logistics_sync));
    if (auto_sync_enabled !== undefined) upsert.run('auto_sync_enabled', String(auto_sync_enabled));

    // 重新加载 Cron 任务
    setupCronJobs();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 200').all();
  res.json({ success: true, data: logs });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  setupCronJobs(); // 启动时加载定时任务
});
