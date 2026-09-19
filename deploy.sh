#!/usr/bin/env bash
# ==============================================================================
# WinDaq Platform 1-Click Production Deployment Script for Oracle Cloud / Ubuntu VPS
# Domain: http://daqwon.in / https://daqwon.in
# ==============================================================================

set -e

echo "=========================================================="
echo "  WINDAQ GAMING PLATFORM (विन डैक) - PRODUCTION DEPLOYER  "
echo "  Target Domain: daqwon.in                                "
echo "=========================================================="

# 1. Update OS Packages
echo "📦 Updating OS packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Node.js 20 LTS & Build Tools
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs build-essential nginx certbot python3-certbot-nginx
fi

# 3. Install Global PM2 Process Manager
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 Process Manager..."
    sudo npm install -g pm2
fi

# 4. Install Project Dependencies
echo "📦 Installing Root & Backend Dependencies..."
npm install --production=false

echo "📦 Installing Frontend Dependencies..."
cd frontend
npm install
echo "🔨 Building Next.js 16 Production Bundle..."
npm run build
cd ..

# 5. Create Log Directories
mkdir -p logs

# 6. Start / Reload Services via PM2
echo "🚀 Starting WinDaq Cluster via PM2..."
pm2 start ecosystem.config.js --env production || pm2 reload ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

# 7. Configure Nginx
echo "🌐 Configuring Nginx for daqwon.in..."
sudo cp infra/nginx/daqwon.conf /etc/nginx/sites-available/daqwon.conf || true
sudo ln -sf /etc/nginx/sites-available/daqwon.conf /etc/nginx/sites-enabled/daqwon.conf || true
sudo nginx -t && sudo systemctl reload nginx

echo "=========================================================="
echo "  🎉 DEPLOYMENT COMPLETE!                                 "
echo "  Platform is live on: https://daqwon.in                 "
echo "  Admin Dashboard:    https://daqwon.in/admin            "
echo "  Health Check:       https://daqwon.in/api/v1/health    "
echo "=========================================================="
