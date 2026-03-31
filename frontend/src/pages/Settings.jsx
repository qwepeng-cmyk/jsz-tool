import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CheckCircle2, Clock, PlayCircle, Settings as SettingsIcon, Bell } from 'lucide-react';
import './SyncPages.css';

const Settings = () => {
    const [config, setConfig] = useState({
        cron_hours_order_sync: '11,15',
        cron_hours_logistics_sync: '17',
        auto_sync_enabled: '1'
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const resp = await axios.get('http://localhost:3001/api/config', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (resp.data.success) {
                    setConfig(prev => ({ ...prev, ...resp.data.data }));
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const resp = await axios.post('http://localhost:3001/api/config', config, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (resp.data.success) {
                setMessage('✅ 配置已保存，并已成功重载定时任务');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (e) {
            setMessage('❌ 保存失败: ' + (e.response?.data?.message || e.message));
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key, val) => {
        setConfig(prev => ({ ...prev, [key]: val }));
    };

    return (
        <div className="sync-module-wrapper fadeIn">
            <div className="action-bar glass-panel shadow-sm">
                <div className="action-group">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> 保存配置
                    </button>
                    {message && <span style={{marginLeft: '1rem', fontSize: '0.9rem', color: message.startsWith('✅') ? '#10b981' : '#ef4444'}}>{message}</span>}
                </div>
            </div>

            <div className="data-panel glass-panel" style={{maxWidth: '800px', margin: '0 auto'}}>
                <div className="panel-header">
                    <SettingsIcon size={18} /> 系统运行设置
                </div>
                <div style={{padding: '2rem'}}>
                    <div className="setting-item">
                        <div className="setting-label">
                            <h4>自动同步开关</h4>
                            <p>开启后，系统将按照设定的时间点自动抓取订单并同步至仓库。</p>
                        </div>
                        <div className="setting-control">
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={config.auto_sync_enabled === '1'} 
                                    onChange={(e) => handleChange('auto_sync_enabled', e.target.checked ? '1' : '0')}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-label">
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <Clock size={16} color="#3b82f6" />
                                <h4>订单同步时间点</h4>
                            </div>
                            <p>每天以下时间点，系统会自动抓取商城新订单并推送至仓库。</p>
                            <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>支持 24 小时格式，多个时间请用逗号隔开。例如：11:30, 15:00, 20:45</span>
                        </div>
                        <div className="setting-control">
                            <input 
                                className="input-field" 
                                value={config.cron_hours_order_sync} 
                                onChange={(e) => handleChange('cron_hours_order_sync', e.target.value)}
                                style={{width: '200px'}}
                            />
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-label">
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <PlayCircle size={16} color="#f59e0b" />
                                <h4>物流回传时间点</h4>
                            </div>
                            <p>每天以下时间点，系统会自动从仓库抓取物流单号并回传至商城后台。</p>
                            <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>例如：17:20, 21:00</span>
                        </div>
                        <div className="setting-control">
                            <input 
                                className="input-field" 
                                value={config.cron_hours_logistics_sync} 
                                onChange={(e) => handleChange('cron_hours_logistics_sync', e.target.value)}
                                style={{width: '200px'}}
                            />
                        </div>
                    </div>

                    <div className="warning-box glass-panel" style={{marginTop: '2rem'}}>
                        <Bell size={20} color="#3b82f6" />
                        <div>
                            <h5>💡 温馨提示</h5>
                            <ul>
                                <li><strong>服务器常驻</strong>：为了保证定时任务运行，服务器（后端程序）需要 24 小时保持开启状态。</li>
                                <li><strong>任务安全性</strong>：自动同步会跳过已标记同步和疑似撞库重复的单子，确保安全。</li>
                                <li><strong>即时生效</strong>：保存设置后，系统会自动重载 cron 计划，无需重启服务器。</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .setting-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .setting-label h4 { margin: 0 0 0.2rem 0; font-size: 1rem; color: #1e293b; }
                .setting-label p { margin: 0; font-size: 0.85rem; color: #64748b; }
                
                .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; }
                .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
                input:checked + .slider { background-color: #3b82f6; }
                input:checked + .slider:before { transform: translateX(24px); }
                .slider.round { border-radius: 34px; }
                .slider.round:before { border-radius: 50%; }

                .warning-box {
                    padding: 1.2rem;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 12px;
                    display: flex;
                    gap: 1rem;
                }
                .warning-box h5 { margin: 0 0 0.5rem 0; color: #0369a1; }
                .warning-box ul { margin: 0; padding-left: 1.2rem; font-size: 0.85rem; color: #0c4a6e; line-height: 1.6; }
            `}</style>
        </div>
    );
};

export default Settings;
