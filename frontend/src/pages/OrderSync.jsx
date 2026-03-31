import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DownloadCloud, CheckSquare, RefreshCw, CheckCircle2, Circle, Play, X, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import './SyncPages.css';

const maskPhone = (phone) => {
  if (!phone) return '-';
  const s = String(phone);
  if (s.length === 11) return s.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  if (s.length > 4) return s.slice(0, 3) + '****' + s.slice(-4);
  return s;
};

const OrderSync = () => {
  const [orders, setOrders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [readerRef, setReaderRef] = useState(null);
  const [sortKey, setSortKey] = useState('创建时间');
  const [sortDir, setSortDir] = useState('desc');
  // 从缓存读取页码，默认为 1
  const [currentPage, setCurrentPage] = useState(() => {
    return parseInt(localStorage.getItem('jsz_orders_page') || '1', 10);
  });

  // 当页码改变时同步到缓存
  useEffect(() => {
    localStorage.setItem('jsz_orders_page', currentPage);
  }, [currentPage]);

  const pageSize = 50;
  const [expandedGoods, setExpandedGoods] = useState(new Set());
  const [expandedAddr, setExpandedAddr] = useState(new Set());
  const [isBinding, setIsBinding] = useState(false);
  const [bindingOrder, setBindingOrder] = useState(null);
  const [erpCode, setErpCode] = useState('');
  const logEndRef = React.useRef(null);

  // 自动滚动日志到底部
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [progressMsg]);

  const fetchOrders = async () => {
    try {
      const resp = await axios.get('http://localhost:3001/api/orders', {
         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const newOrders = resp.data.data || [];
      setOrders(newOrders);
      setSelectedIds(new Set());
      
      // 这里的逻辑确保：如果刷新后的总页数依然涵盖当前页，就绝对不跳转
      const maxPage = Math.ceil(newOrders.length / (pageSize || 50));
      if (maxPage > 0 && currentPage > maxPage) {
         setCurrentPage(maxPage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 强制校验页码
  useEffect(() => {
    if (isNaN(currentPage) || currentPage < 1) setCurrentPage(1);
  }, [currentPage]);

  useEffect(() => { fetchOrders(); }, []);

  const toggleSelect = (id, synced) => {
    if (synced) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAllUnsynced = () => {
    const actionable = orders
      .filter(o => !o.status_warehouse && o.order_data?.['订单状态'] === '待发货')
      .map(o => o.order_id);
    if (actionable.length === 0) {
       return alert('当前没有【待发货】且【未同步】的订单可供选中！');
    }
    const allSelected = actionable.length > 0 && actionable.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionable));
    }
  };

  const closeProgress = () => {
    if (readerRef) readerRef.cancel();
    setIsProcessing(false);
    fetchOrders();
  };

  const startSSEProcess = (url) => {
    setIsProcessing(true);
    setProgressMsg([]);
    setProgressPercent(0);
    const token = localStorage.getItem('token');
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(async response => {
      const reader = response.body.getReader();
      setReaderRef(reader);
      const decoder = new TextDecoder("utf-8");
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n').filter(Boolean);
        
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setProgressMsg(prev => [...prev.slice(-10), data.message]);
              if (data.progress !== undefined) setProgressPercent(data.progress);
              if (data.type === 'complete' || data.type === 'error') {
                setTimeout(() => fetchOrders(), 1000);
              }
            } catch (e) {}
          }
        });
      }
    }).catch(() => {
      setProgressMsg(prev => [...prev, "❌ 连接中断"]);
    });
  };

  const handleScrape = () => startSSEProcess('http://localhost:3001/api/orders/scrape');
  const handleVerifyWarehouse = () => startSSEProcess('http://localhost:3001/api/orders/verify-warehouse');
  const handleBulkSync = () => {
     if (selectedIds.size === 0) return alert('请先勾选需要同步的订单');
     const ids = Array.from(selectedIds).join(',');
     startSSEProcess(`http://localhost:3001/api/orders/sync-warehouse?ids=${ids}`);
  };
  const handleSingleSync = (id) => {
     startSSEProcess(`http://localhost:3001/api/orders/sync-warehouse?ids=${id}`);
  };
  
  const handleOpenBind = (order) => {
    setBindingOrder(order);
    setErpCode(order.platform_code || '');
    setIsBinding(true);
  };

  const handleConfirmBind = async () => {
    if (!erpCode.trim()) return alert('请输入仓库单据编号');
    try {
      const resp = await axios.post('http://localhost:3001/api/orders/bind-warehouse', 
        { order_id: bindingOrder.order_id, platform_code: erpCode },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (resp.data.success) {
        setIsBinding(false);
        fetchOrders();
      }
    } catch (e) {
      alert(e.response?.data?.message || '关联失败');
    }
  };

  // 排序
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };
  const sortIndicator = (key) => {
    if (sortKey !== key) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };
  const sortedOrders = [...orders].sort((a, b) => {
    const valA = a.order_data?.[sortKey] || '';
    const valB = b.order_data?.[sortKey] || '';
    if (sortDir === 'asc') return String(valA).localeCompare(String(valB));
    return String(valB).localeCompare(String(valA));
  });

  // 展开/收起商品详情
  const toggleGoods = (id) => {
    const s = new Set(expandedGoods);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpandedGoods(s);
  };

  // 展开/收起地址详情
  const toggleAddr = (id) => {
    const s = new Set(expandedAddr);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpandedAddr(s);
  };

  // 解析商品名和数量
  const parseGoods = (order) => {
    const namesRaw = order.order_data?.['商品名称'] || '';
    const numsRaw = order.order_data?.['商品数量'] || '';
    const names = namesRaw.replace(/^"|"$/g, '').split('" "');
    const nums = numsRaw.replace(/^"|"$/g, '').split('" "');
    return names.map((n, i) => ({ name: n, qty: nums[i] || '1' }));
  };

  // 判断是否全部选中
  const unsyncedIds = orders.filter(o => !o.status_warehouse && o.order_data?.['订单状态'] === '待发货').map(o => o.order_id);
  const allUnsyncedSelected = unsyncedIds.length > 0 && unsyncedIds.every(id => selectedIds.has(id));

  // 分页数据
  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const currentOrders = sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="sync-module-wrapper">
      <div className="page-container fadeIn">
        <div className="action-bar glass-panel">
          <div className="action-group">
            <button className="btn btn-primary" onClick={handleScrape} disabled={isProcessing}>
              <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
              <span>订单数据同步与核验</span>
            </button>

            <button className="btn btn-secondary" onClick={handleVerifyWarehouse} disabled={isProcessing}>
               <RefreshCw size={16} /> 核验仓库状态
            </button>
            <button className="btn btn-secondary" onClick={selectAllUnsynced} disabled={isProcessing}>
               <CheckSquare size={16} /> {allUnsyncedSelected ? '取消全部选中' : '一键选中未同步'}
            </button>
            <button className="btn btn-success" onClick={handleBulkSync} disabled={isProcessing}>
               <RefreshCw size={16} /> 批量选中同步到仓库
            </button>
         </div>
         <div className="action-hint">
             💡 如果订单已通过其他方式同步到仓库，点击"核验仓库状态"会自动校正同步标记。
         </div>
      </div>

      {isProcessing && (
        <div className="progress-overlay">
           <div className="progress-modal glass-panel">
              <div className="modal-header-row">
                 <h3>🔄 正在处理中...</h3>
                 <button className="close-x" onClick={closeProgress}><X size={20}/></button>
              </div>
              <div className="progress-bar-container">
                 <div className="progress-bar" style={{width: `${progressPercent}%`}}></div>
              </div>
              <div className="progress-logs" ref={logEndRef}>
                 {progressMsg.map((msg, idx) => (
                    <div key={idx} className="log-line">{`>> ${msg}`}</div>
                 ))}
              </div>
              <button className="btn btn-secondary" onClick={closeProgress} style={{marginTop: '1.5rem', width: '100%'}}>
                 停止查看并返回列表
              </button>
           </div>
        </div>
      )}

      <div className="data-panel glass-panel">
         <div className="panel-header">
            <span>列表共计: {orders.length} 笔订单 (已选中 {selectedIds.size} 笔)</span>
         </div>
         <div className="table-scroll-wrapper">
           <table className="data-table">
              <thead>
                 <tr>
                    <th className="sticky-col-1" style={{width: 40, resize: 'none'}}>#</th>
                    <th className="sticky-col-idx" style={{width: 50, resize: 'none'}}>序号</th>
                    <th className="sticky-col-2" style={{width: 200}} onClick={() => handleSort('order_id')}>平台单号 {sortIndicator('order_id')}</th>
                    <th style={{width: 140}} onClick={() => handleSort('创建时间')}>下单时间 {sortIndicator('创建时间')}</th>
                    <th style={{width: 80}} onClick={() => handleSort('订单状态')}>订单状态 {sortIndicator('订单状态')}</th>
                    <th style={{width: 90}}>收件人</th>
                    <th style={{width: 120}}>电话</th>
                    <th style={{width: 260}}>商品名称</th>
                    <th style={{width: 60}} onClick={() => handleSort('商品总数量')}>总数量 {sortIndicator('商品总数量')}</th>
                    <th style={{width: 80}} onClick={() => handleSort('实付金额')}>实付金额 {sortIndicator('实付金额')}</th>
                    <th style={{width: 120}}>买家备注</th>
                    <th style={{width: 100}}>仓库状态</th>
                    <th style={{width: 120}}>操作</th>
                 </tr>
              </thead>
              <tbody>
                 {currentOrders.map((order, index) => {
                    const absIndex = (currentPage - 1) * pageSize + index + 1;
                    const synced = order.status_warehouse === 1;
                    const selected = selectedIds.has(order.order_id);
                    const remark = order.order_data?.['买家备注'] || '';
                    const goodsExpanded = expandedGoods.has(order.order_id);
                    const addrExpanded = expandedAddr.has(order.order_id);
                    const goodsList = parseGoods(order);
                    const firstGoodsText = goodsList.length > 0 ? goodsList[0].name : '-';
                    const truncLen = 20;
                    const orderStatusRaw = order.order_data?.['订单状态'] || '-';
                    const orderStatus = (orderStatusRaw === '退款结束' || orderStatusRaw === '已退款' || orderStatusRaw === '退款中') ? '已退款' : orderStatusRaw;
                    const isDaiFaHuo = orderStatus === '待发货';
                    const isRefunded = orderStatus === '已退款';
                    const isSyncedInStore = (orderStatusRaw === '已完成' || orderStatusRaw === '已发货' || orderStatusRaw === '已收货');

                    // 核心逻辑：高风险订单（商城已退款，但仓库显示已同步）
                    const isDanger = isRefunded && synced;

                    // 状态颜色
                    let statusBadgeClass = 'badge-muted';
                    if (isDanger) statusBadgeClass = 'badge-danger';
                    else if (isDaiFaHuo) statusBadgeClass = 'badge-warning';
                    else if (orderStatus === '已完成' || orderStatus === '已发货') statusBadgeClass = 'badge-success';

                    // 非"待发货"或已同步的，不允许操作同步
                    const canSync = isDaiFaHuo && !synced;

                    // 拼接行样式
                    let rowClass = '';
                    if (isDanger) rowClass = 'row-danger';
                    else if (synced) rowClass = 'row-disabled';

                    return (
                      <React.Fragment key={order.order_id}>
                       <tr className={rowClass}>
                           <td className="sticky-col-1" onClick={() => toggleSelect(order.order_id, !canSync || isDanger)} style={{cursor: (canSync && !isDanger)?'pointer':'not-allowed', textAlign: 'center'}}>
                              {isDanger ? <Circle size={16} color="#ef4444"/> : (!canSync ? <Circle size={16} color="#ccc"/> : (selected ? <CheckCircle2 size={16} color="#10b981"/> : <Circle size={16} color="#94a3b8"/>))}
                           </td>
                          <td className="sticky-col-idx" style={{fontWeight: 600, color: '#64748b'}}>{absIndex}</td>
                          <td className="sticky-col-2" style={{fontFamily: 'monospace', fontSize: '0.75rem'}}>{order.order_id}</td>
                          <td style={{fontSize: '0.8rem', color: '#64748b'}}>{order.order_data?.['创建时间'] || '-'}</td>
                          <td>
                             <span className={`badge ${statusBadgeClass}`} style={{fontSize: '0.7rem'}}>
                                {orderStatus}
                             </span>
                          </td>
                          <td>
                            <span 
                              onClick={() => toggleAddr(order.order_id)} 
                              style={{fontWeight: 600, cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 2}}
                            >
                              {order.order_data?.['收货人'] || '-'}
                              {addrExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                            </span>
                          </td>
                          <td style={{fontSize: '0.85rem'}}>{maskPhone(order.order_data?.['联系电话'])}</td>
                          <td>
                            <div>
                              <span style={{fontSize: '0.8rem'}}>
                                {firstGoodsText.length > truncLen ? firstGoodsText.substring(0, truncLen) + '...' : firstGoodsText}
                                {firstGoodsText.length > 0 && <span style={{color: '#64748b', marginLeft: 4}}>×{goodsList[0]?.qty}</span>}
                              </span>
                              {goodsList.length > 1 && (
                                <span 
                                  onClick={() => toggleGoods(order.order_id)} 
                                  style={{marginLeft: 6, fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', fontWeight: 600}}
                                >
                                  {goodsExpanded ? '收起' : `等${goodsList.length}项 ▾`}
                                </span>
                              )}
                              {goodsList.length === 1 && firstGoodsText.length > truncLen && (
                                <span 
                                  onClick={() => toggleGoods(order.order_id)} 
                                  style={{marginLeft: 6, fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', fontWeight: 600}}
                                >
                                  {goodsExpanded ? '收起' : '展开'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{textAlign: 'center', fontWeight: 600}}>{order.order_data?.['商品总数量'] || '-'}</td>
                          <td style={{fontWeight: 600, color: '#dc2626'}}>¥{order.order_data?.['实付金额'] || '0'}</td>
                          <td style={{fontSize: '0.8rem', color: remark ? '#ea580c' : '#94a3b8'}} title={remark}>{remark || '无'}</td>
                          <td>
                             {synced ? <span className="badge badge-success">仓库已同步</span> : <span className="badge badge-warning">未同步</span>}
                          </td>
                          <td>
                           <div style={{display: 'flex', gap: '8px'}}>
                              <button 
                                 className="btn btn-icon btn-primary" 
                                 title="关联仓库单号"
                                 onClick={() => handleOpenBind(order)}
                              >
                                 <Link2 size={14} />
                              </button>
                              {synced ? (
                                 <button className="btn btn-icon btn-muted" disabled title="已在仓库">
                                    <CheckCircle2 size={14} />
                                 </button>
                              ) : (
                                 <button 
                                    className={`btn btn-icon ${canSync && !isProcessing && !isSyncedInStore ? 'btn-success' : 'btn-muted'}`}
                                    title={canSync ? "同步至仓库" : "当前订单状态不允许同步"}
                                    disabled={!canSync || isProcessing || isSyncedInStore}
                                    onClick={() => handleSingleSync(order.order_id)}
                                 >
                                    <Play size={14} />
                                 </button>
                              )}
                           </div>
                        </td>
                       </tr>
                       {/* 地址展开行 */}
                       {addrExpanded && (
                         <tr className="expand-row">
                           <td className="sticky-col-1" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td className="sticky-col-idx" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td className="sticky-col-2" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td colSpan="10" style={{padding: '0.5rem 1rem 0.5rem 0', background: '#f8fafc', fontSize: '0.8rem', color: '#475569'}}>
                             📍 <strong>地址：</strong>
                             {order.order_data?.['省份'] || ''} {order.order_data?.['城市'] || ''} {order.order_data?.['区县'] || ''} {order.order_data?.['详细地址'] || ''}
                             {order.order_data?.['邮编'] ? ` (邮编: ${order.order_data['邮编']})` : ''}
                           </td>
                         </tr>
                       )}
                       {/* 商品展开行 */}
                       {goodsExpanded && (
                         <tr className="expand-row">
                           <td className="sticky-col-1" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td className="sticky-col-idx" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td className="sticky-col-2" style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}></td>
                           <td colSpan="10" style={{padding: '0.5rem 1rem 0.5rem 0', background: '#f8fafc', fontSize: '0.8rem'}}>
                             <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                               {goodsList.map((g, i) => (
                                 <div key={i} style={{color: '#334155'}}>
                                   <span style={{color: '#64748b', marginRight: 6}}>{i+1}.</span>
                                   {g.name}
                                   <span style={{color: '#2563eb', fontWeight: 600, marginLeft: 6}}>×{g.qty}</span>
                                 </div>
                               ))}
                             </div>
                           </td>
                         </tr>
                       )}
                      </React.Fragment>
                    );
                 })}
                  {orders.length === 0 && <tr><td colSpan="13" className="empty-row">暂无数据，请先点击抓取。</td></tr>}
              </tbody>
           </table>
         </div>
         {orders.length > 0 && (
           <div className="pagination-container">
               <div className="pagination-info">
                  共 {orders.length} 笔数据，当前 第 {currentPage} / {Math.ceil(orders.length / pageSize)} 页
               </div>
               <div className="pagination-controls">
                  <span style={{fontSize: '0.8rem', color: '#64748b'}}>跳至</span>
                  <input 
                    key={currentPage}
                    type="number" 
                    defaultValue={currentPage}
                    min="1" 
                    max={Math.ceil(orders.length / pageSize)}
                    className="grid-input" 
                    style={{width: '50px', padding: '0.2rem 0.4rem', textAlign: 'center', margin: '0 0.2rem'}}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        let p = parseInt(e.target.value, 10);
                        if (!isNaN(p) && p >= 1 && p <= Math.ceil(orders.length / pageSize)) setCurrentPage(p);
                        else e.target.value = currentPage; 
                        e.target.blur();
                      }
                    }}
                    onBlur={(e) => {
                       let p = parseInt(e.target.value, 10);
                       if (!isNaN(p) && p >= 1 && p <= Math.ceil(orders.length / pageSize)) setCurrentPage(p);
                       else e.target.value = currentPage;
                    }}
                  />
                  <span style={{fontSize: '0.8rem', color: '#64748b', marginRight: '1rem'}}>页</span>

                  <button className="btn btn-small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>首页</button>
                  <button className="btn btn-small" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>上一页</button>
                  <button className="btn btn-small" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === Math.ceil(orders.length / pageSize)}>下一页</button>
               </div>
           </div>
         )}
      </div>
      {isBinding && (
        <div className="progress-overlay" style={{zIndex: 2000}}>
           <div className="progress-modal glass-panel" style={{maxWidth: '400px'}}>
              <div className="modal-header-row">
                 <h3>🔗 关联仓库单号</h3>
                 <button className="close-x" onClick={() => setIsBinding(false)}><X size={20}/></button>
              </div>
              <div style={{margin: '1rem 0'}}>
                 <p style={{fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem'}}>
                    针对手动录入的订单，请填入管易 ERP 中的系统单据编号（SDO...）。关联后，系统将不再重复推送该订单，并可自动抓取物流信息。
                 </p>
                 <div className="input-group">
                    <label style={{fontSize: '0.8rem', fontWeight: 600}}>商城订单 ID</label>
                    <input className="input-field" value={bindingOrder?.order_id || ''} disabled />
                 </div>
                 <div className="input-group" style={{marginTop: '1rem'}}>
                    <label style={{fontSize: '0.8rem', fontWeight: 600}}>仓库系统单号 (SDO...)</label>
                    <input 
                       className="input-field" 
                       placeholder="请输入 SDOXXXXXXXX" 
                       value={erpCode}
                       onChange={(e) => setErpCode(e.target.value)}
                       autoFocus
                    />
                 </div>
              </div>
              <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                 <button className="btn btn-secondary" style={{flex: 1}} onClick={() => setIsBinding(false)}>取消</button>
                 <button className="btn btn-primary" style={{flex: 1}} onClick={handleConfirmBind}>提交关联</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .btn-icon { padding: 4px 8px; }
        .btn-icon.btn-primary { background: #3b82f6; color: white; }
        .btn-icon.btn-muted { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
        .input-group { display: flex; flex-direction: column; gap: 4px; }
        .input-field { 
           padding: 8px 12px; 
           border: 1px solid #e2e8f0; 
           border-radius: 6px; 
           font-family: inherit;
        }
        .input-field:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
      `}</style>
      </div>
    </div>
  );
};

export default OrderSync;
