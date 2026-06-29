#!/bin/bash
#============================================================
#  GGE-BOT VPS Setup Script
#  Target: Debian (11 / 12 / 13) - VPS Setup
#  Author: Developer
#  Domain: yourdomian.domain
#  Usage: chmod +x setup-vps.sh && ./setup-vps.sh
#============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}[✓] $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_warn() {
    echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
    echo -e "${RED}[✗] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root: sudo ./setup-vps.sh"
    exit 1
fi

BOT_USER="ggebot"
BOT_DIR="/home/${BOT_USER}/GGE-BOT"
NODE_VERSION="22"
WEB_PORT="3001"
DOMAIN="Your.Domian"
EMAIL="example@gmail.com"

print_step "Step 1/11: Updating system packages & installing dependencies"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    ufw \
    htop \
    nano \
    unzip \
    tar \
    ca-certificates \
    gnupg \
    lsb-release \
    fontconfig \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    nginx \
    certbot \
    python3-certbot-nginx \
    sqlite3

print_step "Step 2/11: Installing Node.js ${NODE_VERSION}.x"
if ! command -v node &> /dev/null || [[ ! "$(node -v)" == v${NODE_VERSION}* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}Node.js $(node -v) installed successfully${NC}"
    echo -e "${GREEN}npm $(npm -v) installed successfully${NC}"
else
    echo -e "${GREEN}Node.js $(node -v) already installed${NC}"
fi

# Install pm2 globally for process management
print_step "Step 3/11: Installing PM2 process manager"
npm install -g pm2

print_step "Step 4/11: Creating bot user and directory"
if ! id "$BOT_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$BOT_USER"
    echo -e "${GREEN}User '${BOT_USER}' created${NC}"
else
    echo -e "${GREEN}User '${BOT_USER}' already exists${NC}"
fi

# Create the bot directory and backup directory
mkdir -p "$BOT_DIR"
mkdir -p "/home/${BOT_USER}/backups"
chown -R ${BOT_USER}:${BOT_USER} /home/${BOT_USER}

print_step "Step 5/11: Configuring swap space (2GB)"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}2GB swap created and enabled${NC}"
else
    echo -e "${GREEN}Swap already exists${NC}"
fi

# Optimize swap usage - lower swappiness for better performance
echo "vm.swappiness=10" > /etc/sysctl.d/99-ggebot.conf
echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.d/99-ggebot.conf

print_step "Step 6/11: Optimizing system limits for Node.js workers"
cat > /etc/security/limits.d/ggebot.conf << EOF
${BOT_USER}  soft  nofile  65535
${BOT_USER}  hard  nofile  65535
${BOT_USER}  soft  nproc   4096
${BOT_USER}  hard  nproc   4096
EOF

# Network optimizations for high-concurrency WebSocket connections
cat >> /etc/sysctl.d/99-ggebot.conf << EOF
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=1024
net.ipv4.tcp_keepalive_time=300
net.ipv4.tcp_keepalive_intvl=60
net.ipv4.tcp_keepalive_probes=5
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_tw_reuse=1
net.core.netdev_max_backlog=5000
EOF

sysctl --system > /dev/null 2>&1
echo -e "${GREEN}System limits and network parameters optimized${NC}"

print_step "Step 7/11: Configuring firewall (UFW) - Restricting Port 3001"
# Configure firewall to allow SSH and Nginx ports, but block direct port 3001
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'

# Proactively delete any rules allowing port 3001 directly to make it secure
ufw delete allow ${WEB_PORT}/tcp >/dev/null 2>&1 || true
ufw delete allow ${WEB_PORT} >/dev/null 2>&1 || true

# Enable without prompt
echo "y" | ufw enable
ufw status
echo -e "${GREEN}Firewall configured: SSH and Nginx Full allowed. Port ${WEB_PORT} blocked from direct access.${NC}"

print_step "Step 8/11: Configuring Nginx Reverse Proxy for ${DOMAIN}"
# Write Nginx configuration with WebSocket upgrade support
cat > /etc/nginx/sites-available/ggebot << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

# Enable configuration and disable default Nginx site
ln -sf /etc/nginx/sites-available/ggebot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Restart Nginx
systemctl restart nginx
echo -e "${GREEN}Nginx reverse proxy for ${DOMAIN} configured and restarted${NC}"

print_step "Step 9/11: Automating Let's Encrypt SSL via Certbot"
# Attempt to obtain SSL certificate automatically
if certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ${EMAIL} --redirect; then
    echo -e "${GREEN}SSL Certificate successfully installed for ${DOMAIN}!${NC}"
else
    print_warn "Certbot auto-configuration skipped or failed."
    echo -e "Please ensure your domain DNS (A-Record) points to this server's IP, then run:"
    echo -e "  ${CYAN}sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}${NC}"
fi

print_step "Step 10/11: Creating Daily Database Backup Script & Cron Job"
# Create daily backup shell script using sqlite3 hot-backup command
cat > /home/${BOT_USER}/backup-db.sh << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/home/ggebot/backups"
DB_FILE="/home/ggebot/GGE-BOT/user.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/user_${TIMESTAMP}.db"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
    echo "Starting hot backup of GGE-BOT database..."
    if command -v sqlite3 &> /dev/null; then
        sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
    else
        cp "$DB_FILE" "$BACKUP_FILE"
    fi
    chmod 600 "$BACKUP_FILE"
    chown ggebot:ggebot "$BACKUP_FILE"
    
    # Delete backups older than 30 days
    find "$BACKUP_DIR" -name "user_*.db" -type f -mtime +30 -delete
    echo "[$(date)] Database backup created: $BACKUP_FILE" >> "${BACKUP_DIR}/backup.log"
else
    echo "[$(date)] Error: Database file not found at $DB_FILE" >> "${BACKUP_DIR}/backup.log"
fi
BACKUP_EOF

chmod +x /home/${BOT_USER}/backup-db.sh
chown ${BOT_USER}:${BOT_USER} /home/${BOT_USER}/backup-db.sh

# Link backup script to system daily cron jobs
cat > /etc/cron.daily/ggebot-backup << EOF
#!/bin/bash
/bin/bash /home/ggebot/backup-db.sh
EOF
chmod +x /etc/cron.daily/ggebot-backup
echo -e "${GREEN}Daily SQLite backup script and cron job created successfully.${NC}"

print_step "Step 11/11: Creating systemd service & helper scripts"
# Create systemd service file
cat > /etc/systemd/system/ggebot.service << EOF
[Unit]
Description=GGE-BOT Game Automation Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${BOT_USER}
Group=${BOT_USER}
WorkingDirectory=${BOT_DIR}
ExecStart=/usr/bin/node --max-old-space-size=4096 --optimize-for-size --max-semi-space-size=2 main.js
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production
Environment=UV_THREADPOOL_SIZE=16

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${BOT_DIR} /home/${BOT_USER}/backups
PrivateTmp=true

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ggebot

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo -e "${GREEN}Systemd service 'ggebot' registered.${NC}"

# Set up log rotation
cat > /etc/logrotate.d/ggebot << EOF
/var/log/ggebot/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${BOT_USER} ${BOT_USER}
}
EOF

# Create deploy script
cat > /home/${BOT_USER}/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
BOT_DIR="/home/ggebot/GGE-BOT"
echo "📦 Deploying GGE-BOT..."
cd "$BOT_DIR"

echo "📥 Installing dependencies..."
npm install --production

cd website
npm install --legacy-peer-deps
npm run build
cd ..

echo "🔄 Restarting service..."
sudo systemctl restart ggebot

echo "✅ Deployment complete!"
echo "📊 Check status: sudo systemctl status ggebot"
echo "📋 View logs:    sudo journalctl -u ggebot -f"
DEPLOY_EOF
chmod +x /home/${BOT_USER}/deploy.sh

# Create status check script  
cat > /home/${BOT_USER}/status.sh << 'STATUS_EOF'
#!/bin/bash
echo "═════════════════════════════════════════════════════════════"
echo "                GGE-BOT VPS STATUS REPORT                    "
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "🤖 Service Status:"
systemctl is-active --quiet ggebot && echo -e "   Status: ${GREEN}RUNNING${NC}" || echo -e "   Status: ${RED}STOPPED${NC}"
echo ""
echo "💻 System Resource Metrics:"
echo "   CPU Load: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% used"
echo "   RAM Info: $(free -h | awk '/Mem:/ {printf "%s used / %s total (%.1f%%)", $3, $2, $3/$2*100}')"
echo "   Swap:     $(free -h | awk '/Swap:/ {printf "%s used / %s total", $3, $2}')"
echo "   Disk:     $(df -h / | awk 'NR==2 {printf "%s used / %s total (%s)", $3, $2, $5}')"
echo ""
echo "💾 Database Backup Status:"
echo "   Backup Location: /home/ggebot/backups"
echo "   Total Backups:   $(find /home/ggebot/backups -name "user_*.db" | wc -l)"
echo "   Latest Backups:"
find /home/ggebot/backups -name "user_*.db" -type f -exec ls -lh {} \; | tail -n 5
echo ""
echo "═════════════════════════════════════════════════════════════"
STATUS_EOF
chmod +x /home/${BOT_USER}/status.sh

chown -R ${BOT_USER}:${BOT_USER} /home/${BOT_USER}

# Allow ggebot user to control service and view logs without password prompts
echo "${BOT_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ggebot, /bin/systemctl stop ggebot, /bin/systemctl start ggebot, /bin/systemctl status ggebot, /bin/systemctl enable ggebot, /bin/systemctl disable ggebot, /bin/journalctl -u ggebot*" > /etc/sudoers.d/ggebot

# Apply sysctl parameters
sysctl -p /etc/sysctl.d/99-ggebot.conf > /dev/null 2>&1

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ GGE-BOT VPS Configuration Successful!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps on VPS:${NC}"
echo ""
echo -e "  1. Switch to the dedicated bot user:"
echo -e "     ${CYAN}su - ${BOT_USER}${NC}"
echo ""
echo -e "  2. Go to the bot directory and deploy:"
echo -e "     ${CYAN}cd GGE-BOT && bash ~/deploy.sh${NC}"
echo ""
echo -e "  3. Enable auto-start at boot:"
echo -e "     ${CYAN}sudo systemctl enable ggebot${NC}"
echo ""
echo -e "  4. Manually trigger a database backup test:"
echo -e "     ${CYAN}bash ~/backup-db.sh${NC}"
echo ""
echo -e "${YELLOW}🌐 Application URL:${NC} ${GREEN}http://${DOMAIN}${NC} (or ${GREEN}https://${DOMAIN}${NC} after SSL finishes)"
echo -e "${YELLOW}🔑 Default Credentials:${NC} 88 / 88"
echo -e "${RED}⚠️  Make sure to change the admin password after logging in!${NC}"
echo ""
