import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await axios.post('http://localhost:3001/api/auth/login', { username, password });
      if (resp.data.success) {
        localStorage.setItem('token', resp.data.token);
        localStorage.setItem('username', resp.data.username);
        navigate('/order-sync');
      }
    } catch (err) {
      setError(err.response?.data?.message || '登录失败，请检查网络设置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card glass-effect">
        <h2 className="login-title">疆手作订单同步系统</h2>
        <p className="login-subtitle">请验证您的身份</p>
        
        {error && <div className="error-banner">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>账号</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="请输入管理员账号"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="请输入密码"
              disabled={loading}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '验证中...' : '登 录 系 统'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
