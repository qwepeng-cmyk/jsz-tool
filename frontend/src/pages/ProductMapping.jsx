import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import './SyncPages.css';

const ProductMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortKey, setSortKey] = useState('keyword');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  const [formData, setFormData] = useState({ keyword: '', item_code: '', item_name: '' });

  const fetchMappings = async () => {
    try {
      const resp = await axios.get('http://localhost:3001/api/mappings', {
         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMappings(resp.data.data || []);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return <span className="sort-indicator">⇅</span>;
    return <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const sortedMappings = [...mappings].sort((a, b) => {
    const valA = a[sortKey] || '';
    const valB = b[sortKey] || '';
    if (sortDir === 'asc') return String(valA).localeCompare(String(valB));
    return String(valB).localeCompare(String(valA));
  });

  const handleEdit = (mapping) => {
    setEditingId(mapping.id);
    setIsAdding(false);
    setFormData({ keyword: mapping.keyword, item_code: mapping.item_code, item_name: mapping.item_name });
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ keyword: '', item_code: '', item_name: '' });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ keyword: '', item_code: '', item_name: '' });
  };

  const handleSave = async () => {
    if (!formData.keyword || !formData.item_code) return alert("关键字和商品代码必填");
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (isAdding) {
         await axios.post('http://localhost:3001/api/mappings', formData, { headers });
      } else {
         await axios.put(`http://localhost:3001/api/mappings/${editingId}`, formData, { headers });
      }
      handleCancel();
      fetchMappings();
    } catch (e) {
      alert(e.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("确定要删除此映射规则吗？")) return;
    try {
      await axios.delete(`http://localhost:3001/api/mappings/${id}`, {
         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchMappings();
    } catch (e) {
      alert('删除失败');
    }
  };

  const currentMappings = sortedMappings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="sync-module-wrapper fadeIn">
      <div className="page-container">
        <div className="action-bar glass-panel shadow-sm">
          <div className="action-group">
            <button className="btn btn-primary" onClick={handleAddNew} disabled={isAdding || editingId}>
              <Plus size={16} /> 新增映射规则
            </button>
          </div>
          <div className="action-hint">
            💡 自动解析逻辑：系统同步时会根据商品名称关键字自动匹配仓库代码。
          </div>
        </div>

        <div className="data-panel glass-panel">
          <div className="panel-header">
            <span>列表共计: {mappings.length} 条映射规则 (每页 {pageSize} 条)</span>
          </div>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>序号</th>
                  <th style={{ width: 250 }} onClick={() => handleSort('keyword')}>
                    商城标题关键字 {sortIndicator('keyword')}
                  </th>
                  <th style={{ width: 200 }} onClick={() => handleSort('item_code')}>
                    仓库商品代码 {sortIndicator('item_code')}
                  </th>
                  <th style={{ width: 300 }} onClick={() => handleSort('item_name')}>
                    映射仓库商品名称 {sortIndicator('item_name')}
                  </th>
                  <th style={{ width: 140, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="edit-row animate-fadeIn">
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>*</td>
                    <td>
                      <input 
                        className="grid-input" 
                        value={formData.keyword} 
                        placeholder="关键字"
                        onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} 
                      />
                    </td>
                    <td>
                      <input 
                        className="grid-input" 
                        value={formData.item_code} 
                        placeholder="SKU123"
                        onChange={(e) => setFormData({ ...formData, item_code: e.target.value })} 
                      />
                    </td>
                    <td>
                      <input 
                        className="grid-input" 
                        value={formData.item_name} 
                        placeholder="商品名称"
                        onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} 
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="btn btn-icon btn-success" onClick={handleSave}><Save size={14} /></button>
                        <button className="btn btn-icon btn-secondary" onClick={handleCancel}><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {currentMappings.map((map, index) => {
                  const absIndex = (currentPage - 1) * pageSize + index + 1;
                  if (editingId === map.id) {
                    return (
                      <tr key={map.id} className="edit-row">
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{absIndex}</td>
                        <td>
                          <input className="grid-input" value={formData.keyword} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} />
                        </td>
                        <td>
                          <input className="grid-input" value={formData.item_code} onChange={(e) => setFormData({ ...formData, item_code: e.target.value })} />
                        </td>
                        <td>
                          <input className="grid-input" value={formData.item_name} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn btn-icon btn-success" onClick={handleSave}><Save size={14} /></button>
                            <button className="btn btn-icon btn-secondary" onClick={handleCancel}><X size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={map.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{absIndex}</td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{map.keyword}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{map.item_code}</td>
                      <td style={{ fontSize: '0.85rem' }}>{map.item_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button className="btn btn-icon btn-secondary" onClick={() => handleEdit(map)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(map.id)} style={{ color: '#ef4444' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {mappings.length === 0 && !isAdding && (
                  <tr>
                    <td colSpan="5" className="empty-row">当前映射规则库为空</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {mappings.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                共 {mappings.length} 笔数据，当前 第 {currentPage} / {Math.ceil(mappings.length / pageSize)} 页
              </div>
              <div className="pagination-controls">
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>跳至</span>
                <input 
                  key={currentPage}
                  type="number" 
                  defaultValue={currentPage}
                  min="1" 
                  max={Math.ceil(mappings.length / pageSize)}
                  className="grid-input" 
                  style={{ width: '50px', padding: '0.2rem 0.4rem', textAlign: 'center', margin: '0 0.2rem' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      let p = parseInt(e.target.value, 10);
                      let maxp = Math.ceil(mappings.length / pageSize);
                      if (!isNaN(p) && p >= 1 && p <= maxp) setCurrentPage(p);
                      else e.target.value = currentPage; 
                      e.target.blur();
                    }
                  }}
                  onBlur={(e) => {
                    let p = parseInt(e.target.value, 10);
                    let maxp = Math.ceil(mappings.length / pageSize);
                    if (!isNaN(p) && p >= 1 && p <= maxp) setCurrentPage(p);
                    else e.target.value = currentPage;
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '1rem' }}>页</span>

                <button className="btn btn-small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>首页</button>
                <button className="btn btn-small" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>上一页</button>
                <button className="btn btn-small" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === Math.ceil(mappings.length / pageSize)}>下一页</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductMapping;
