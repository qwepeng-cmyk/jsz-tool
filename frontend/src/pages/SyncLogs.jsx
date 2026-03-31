import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, Search, FileText, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import './SyncPages.css';

const SyncLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [expandedLog, setExpandedLog] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const resp = await axios.get('http://localhost:3001/api/logs', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setLogs(resp.data.data || []);
            setCurrentPage(1);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    const filteredLogsList = filter === 'ALL' ? logs : logs.filter(l => l.type === filter);
    const totalPages = Math.ceil(filteredLogsList.length / pageSize);
    const currentLogs = filteredLogsList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const typeMap = {
        'SCRAPE': { label: '订单抓取', color: '#3b82f6' },
        'WAREHOUSE': { label: '同步仓库', color: '#10b981' },
        'LOGISTICS': { label: '物流回传', color: '#f59e0b' },
        'CHECK_WAREHOUSE': { label: '核验物流', color: '#8b5cf6' }
    };

    const statusMap = {
        'SUCCESS': { label: '成功', icon: <CheckCircle2 size={16} color="#10b981" /> },
        'PARTIAL': { label: '部分成功', icon: <AlertCircle size={16} color="#f59e0b" /> },
        'FAIL': { label: '失败', icon: <XCircle size={16} color="#ef4444" /> }
    };

    return (
        <div className="sync-module-wrapper fadeIn">
            <div className="page-container">
                <div className="action-bar glass-panel shadow-sm">
                    <div className="action-group">
                        <div className="filter-group">
                            <span>任务类型筛选:</span>
                            <select className="input-field" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '160px' }}>
                                <option value="ALL">全部任务</option>
                                <option value="SCRAPE">📦 订单抓取</option>
                                <option value="WAREHOUSE">🏭 同步仓库</option>
                                <option value="LOGISTICS">🚚 物流回传</option>
                                <option value="CHECK_WAREHOUSE">🔍 核验物流</option>
                            </select>
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
                        <History size={16} className={loading ? 'animate-spin' : ''} /> 刷新日志列表
                    </button>
                </div>

                <div className="data-panel glass-panel">
                    <div className="panel-header">
                        <span>系统运行日志 (最近 30 天记录)</span>
                    </div>
                    <div className="table-scroll-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col-idx" style={{ width: '60px', textAlign: 'center' }}>序号</th>
                                    <th style={{ width: '180px' }}>执行时间</th>
                                    <th style={{ width: '120px' }}>任务分类</th>
                                    <th style={{ width: '100px', textAlign: 'center' }}>触发方式</th>
                                    <th style={{ width: '110px' }}>执行结果</th>
                                    <th>任务摘要</th>
                                    <th style={{ width: '70px', textAlign: 'center' }}>详情</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="empty-row">正在加载系统日志...</td></tr>
                                ) : currentLogs.map((log, index) => {
                                    const absIndex = (currentPage - 1) * pageSize + index + 1;
                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr>
                                                <td className="sticky-col-idx" style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{absIndex}</td>
                                                <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.created_at}</td>
                                                <td>
                                                    <span style={{ color: typeMap[log.type]?.color, fontWeight: 700, fontSize: '0.85rem' }}>
                                                        {typeMap[log.type]?.label || log.type}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {log.trigger_type === 'AUTOMATIC' ? (
                                                        <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>定时自发</span>
                                                    ) : (
                                                        <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>手动触发</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {statusMap[log.status]?.icon}
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{statusMap[log.status]?.label || log.status}</span>
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '0.85rem', color: '#1e293b' }}>{log.summary}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button 
                                                        className="btn btn-icon btn-secondary" 
                                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                        title="查看详情"
                                                    >
                                                        {expandedLog === log.id ? <ChevronUp size={16}/> : <FileText size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedLog === log.id && (
                                                <tr className="expand-row">
                                                    <td colSpan="7">
                                                        <div className="expand-content" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                            <div style={{ 
                                                                padding: '1.2rem', 
                                                                whiteSpace: 'pre-wrap', 
                                                                fontSize: '0.75rem', 
                                                                color: '#334155', 
                                                                background: '#ffffff',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                maxHeight: '400px', 
                                                                overflowY: 'auto', 
                                                                fontFamily: 'monospace',
                                                                lineHeight: '1.5'
                                                            }}>
                                                                {log.details || '无详细执行数据'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {currentLogs.length === 0 && !loading && (
                                    <tr><td colSpan="7" className="empty-row">未搜索到符合条件的日志记录</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {filteredLogsList.length > 0 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            共 {filteredLogsList.length} 笔数据，当前 第 {currentPage} / {totalPages} 页
                        </div>
                        <div className="pagination-controls">
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>跳至</span>
                            <input 
                                key={currentPage}
                                type="number" 
                                defaultValue={currentPage}
                                min="1" 
                                max={totalPages}
                                className="grid-input" 
                                style={{ width: '50px', padding: '0.2rem 0.4rem', textAlign: 'center', margin: '0 0.2rem' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        let p = parseInt(e.target.value, 10);
                                        if (!isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p);
                                        else e.target.value = currentPage; 
                                        e.target.blur();
                                    }
                                }}
                                onBlur={(e) => {
                                    let p = parseInt(e.target.value, 10);
                                    if (!isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p);
                                    else e.target.value = currentPage;
                                }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '1rem' }}>页</span>

                            <button className="btn btn-small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>首页</button>
                            <button className="btn btn-small" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>上一页</button>
                            <button className="btn btn-small" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>下一页</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncLogs;
