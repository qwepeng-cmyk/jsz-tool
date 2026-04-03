#!/bin/bash
# JSZ-TOOL Server Deployment Script (Production)
# This script should be run on the ALIBABA CLOUD ECS.

PROJECT_ROOT="/root/jsz-tool"
NGINX_CONF_PATH="/etc/nginx/conf.d/jsz_nginx_prod.conf"

echo "🚀 Starting Deployment Process..."

# 1. Sync Code (pull from git)
if [ -d "$PROJECT_ROOT/.git" ]; then
    echo "📥 Updating code via git pull..."
    cd $PROJECT_ROOT && git pull
else
    echo "❌ Error: Project directory not found or not a git repository."
    echo "Please clone your repository to $PROJECT_ROOT first."
    exit 1
fi

# 2. Patch Code for Production (Dynamic Adapter)
# This replaces hardcoded localhost:3001 with relative /api paths ONLY on server.
echo "🛠 Patching API endpoints for production environment..."
find frontend/src -name "*.jsx" | xargs sed -i 's/http:\/\/localhost:3001/\/api/g'

# 3. Build Frontend
echo "📦 Building Frontend Static Assets..."
cd frontend
npm install --registry=https://registry.npmmirror.com
npm run build

# 4. Update Backend Dependencies and Restart
echo "🔥 Restarting Backend via PM2..."
cd ../server
npm install --registry=https://registry.npmmirror.com
pm2 stop jsz-backend 2>/dev/null || true
pm2 start index.js --name jsz-backend

# 5. Ensure Nginx Config is linked
echo "🌐 Updating Nginx Configuration..."
if [ -f "$PROJECT_ROOT/nginx_jsz_prod.conf" ]; then
    sudo cp "$PROJECT_ROOT/nginx_jsz_prod.conf" "$NGINX_CONF_PATH"
    sudo nginx -t && sudo systemctl restart nginx
    echo "✅ Nginx restarted successfully."
else
    echo "⚠️ Warning: nginx_jsz_prod.conf not found. Manual nginx config might be needed."
fi

echo "✅ Deployment COMPLETE!"
echo "👉 Access your app at: http://jsz.petmbti.cn"
