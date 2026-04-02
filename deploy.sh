#!/bin/bash
# JSZ-TOOL 一键部署脚本 (Alibaba Cloud Linux 3 / CentOS 7/8 兼容)

echo "🚀 开始部署 JSZ 订单同步系统..."

# 1. 安装基础依赖
sudo yum update -y
sudo yum install -y git python3 python3-pip

# 2. 安装 Node.js 20.x
echo "📦 正在安装 Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 3. 安装 PM2
sudo npm install -g pm2

# 4. 安装 Python 依赖
pip3 install requests

# 5. 进入项目目录并安装依赖
# 假设您已在当前目录执行过 git clone
echo "📥 正在安装前后端依赖..."
cd server && npm install
cd ../frontend && npm install

# 6. 启动后端进程 (PM2)
echo "🔥 启动后台服务..."
cd ../server
pm2 stop jsz-backend 2>/dev/null || true
pm2 start index.js --name jsz-backend

# 7. 启动前端预览测试 (非生产环境建议后续改 Nginx 静态包)
# 这里暂时使用 dev 模式确保能跑通，后续建议 npm run build
echo "🌈 启动前端服务 (5173 端口)..."
cd ../frontend
pm2 stop jsz-frontend 2>/dev/null || true
pm2 start "npm run dev -- --host" --name jsz-frontend

echo "✅ 部署完成！"
echo "👉 后端接口: http://YOUR_IP:3001"
echo "👉 前端地址: http://YOUR_IP:5173"
echo "⚠️ 请确保阿里云安全组已开放 3001 和 5173 端口。"
