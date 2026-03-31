import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import OrderSync from './pages/OrderSync';
import LogisticsSync from './pages/LogisticsSync';
import ProductMapping from './pages/ProductMapping';
import SyncLogs from './pages/SyncLogs';
import SettingsPage from './pages/Settings';
import { DownloadCloud, Truck, Settings as SettingsIcon, LogOut, History, PenTool, Menu, X } from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const menuItems = [
    { path: '/order-sync', label: '订单同步', icon: <DownloadCloud size={18} /> },
    { path: '/logistics-sync', label: '物流回传', icon: <Truck size={18} /> },
    { path: '/mappings', label: '商品映射', icon: <SettingsIcon size={18} /> },
    { path: '/logs', label: '同步日志', icon: <History size={18} /> },
    { path: '/settings', label: '参数设置', icon: <PenTool size={18} /> }
  ];

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Overlay for mobile */}
      <div className="sidebar-overlay" onClick={closeSidebar}></div>
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h2>疆手作</h2>
              <p>订单同步系统</p>
            </div>
            <button className="sidebar-close-btn mobile-only" onClick={closeSidebar}>
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="nav-menu">
          {menuItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
             管理员: {localStorage.getItem('username') || 'admin'}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
             <LogOut size={16} /> 退出登录
          </button>
        </div>
      </aside>
      
      <main className="main-content">
         <header className="top-header">
            <div className="header-left">
              <button className="menu-toggle-btn mobile-only" onClick={toggleSidebar}>
                <Menu size={24} />
              </button>
              <div className="header-title">
                 {menuItems.find(m => m.path === location.pathname)?.label || '管理后台'}
              </div>
            </div>
            <div className="header-right">
               <a href="https://my.feishu.cn/wiki/Lo5TwHwJsi2I8ik9QrMczoHUnmc?from=from_copylink" target="_blank" rel="noopener noreferrer" className="doc-link">
                  📖 <span className="doc-text">使用说明文档</span>
               </a>
               <div className="header-status desktop-only" title="当前系统界面装饰文本，未来可接入真实WebSocket监控">
                  <span className="status-dot"></span>系统实时监控中
               </div>
            </div>
         </header>
         <div className="page-wrapper">
            <Outlet />
         </div>
      </main>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/order-sync" replace />} />
          <Route path="order-sync" element={<OrderSync />} />
          <Route path="logistics-sync" element={<LogisticsSync />} />
          <Route path="mappings" element={<ProductMapping />} />
          <Route path="logs" element={<SyncLogs />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
