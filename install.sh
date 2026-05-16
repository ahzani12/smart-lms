#!/bin/bash
set -e

# ============================================
# Smart LMS - One-Click Installer
# Domain + Nginx + Cloudflare SSL + PostgreSQL
# ============================================

echo "============================================"
echo "  Smart LMS Installer"
echo "============================================"
echo ""

# --- Input ---
read -p "Domain (contoh: lms.sekolahku.id): " DOMAIN
read -p "DB Password (untuk user smart_lms_admin): " DB_PASS
echo ""

# Defaults
DB_NAME="smart_lms"
DB_USER="smart_lms_admin"
BACKEND_PORT=8085
FRONTEND_DIR="/var/www/smart-lms"
BACKEND_DIR="/root/smart-lms/backend"
FRONTEND_SRC="/root/smart-lms/frontend"

echo ">>> Domain: $DOMAIN"
echo ">>> DB: $DB_NAME / $DB_USER"
echo ">>> Backend port: $BACKEND_PORT"
echo ""

# --- 1. Install dependencies ---
echo "[1/7] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib curl gnupg2 > /dev/null 2>&1

# Node.js (jika belum ada)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
fi

# Go (jika belum ada)
if ! command -v go &> /dev/null; then
    wget -q https://go.dev/dl/go1.22.4.linux-amd64.tar.gz -O /tmp/go.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
fi

# PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi

echo "    Done."

# --- 2. Setup PostgreSQL ---
echo "[2/7] Setting up PostgreSQL..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1
echo "    Done."

# --- 3. Build Backend ---
echo "[3/7] Building backend..."
cd "$BACKEND_DIR"

# Create .env for backend
cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=$(openssl rand -hex 32)
PORT=$BACKEND_PORT
EOF

go build -o smart-lms . 2>&1
echo "    Done."

# --- 4. Build Frontend ---
echo "[4/7] Building frontend..."
cd "$FRONTEND_SRC"
npm install --silent 2>/dev/null
npm run build 2>&1 | tail -1
mkdir -p "$FRONTEND_DIR"
cp -r dist/* "$FRONTEND_DIR/"
echo "    Done."

# --- 5. Setup PM2 ---
echo "[5/7] Setting up PM2..."
pm2 delete smart-lms 2>/dev/null || true
cd "$BACKEND_DIR"
pm2 start ./smart-lms --name smart-lms
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
echo "    Done."

# --- 6. Setup Nginx + Certbot SSL ---
echo "[6/8] Configuring Nginx..."

# Install certbot
apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

# Nginx config (HTTP dulu, certbot nanti upgrade ke HTTPS)
cat > /etc/nginx/sites-available/smart-lms <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 50m;

    # Frontend (SPA)
    root $FRONTEND_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy ke backend
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # Upload files
    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/smart-lms /etc/nginx/sites-enabled/smart-lms
nginx -t && systemctl reload nginx
echo "    Done."

# --- 7. SSL Certificate (Let's Encrypt) ---
echo "[7/8] Obtaining SSL certificate..."
echo "    NOTE: Domain harus sudah pointing ke IP ini!"
echo "    Jika pakai Cloudflare, MATIKAN proxy (grey cloud) dulu sementara."
echo ""
read -p "    Domain sudah pointing ke IP ini? (y/n): " SSL_CONFIRM
if [ "$SSL_CONFIRM" = "y" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
    echo "    SSL installed! Auto-renew aktif."
else
    echo "    Skipped. Jalankan manual nanti:"
    echo "    certbot --nginx -d $DOMAIN --redirect"
fi
echo "    Done."

# --- 8. Seed superadmin ---
echo "[8/8] Seeding superadmin..."
HASH=$(cd "$BACKEND_DIR" && go run -mod=mod /tmp/seed_super.go 2>/dev/null || echo "")
if [ -z "$HASH" ]; then
    # Fallback: generate hash inline
    cat > /tmp/seed_super.go <<'GOEOF'
package main
import (
    "fmt"
    "golang.org/x/crypto/bcrypt"
)
func main() {
    hash, _ := bcrypt.GenerateFromPassword([]byte("super123"), bcrypt.DefaultCost)
    fmt.Println(string(hash))
}
GOEOF
    HASH=$(cd "$BACKEND_DIR" && go run /tmp/seed_super.go)
fi

PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO users (name, email, password, role, active, created_at, updated_at)
SELECT 'Super Admin', 'super@lms.id', '$HASH', 'superadmin', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');
" > /dev/null 2>&1 || true
echo "    Done."

# --- Summary ---
echo ""
echo "============================================"
echo "  INSTALASI SELESAI!"
echo "============================================"
echo ""
echo "  Domain  : https://$DOMAIN"
echo "  Backend : http://127.0.0.1:$BACKEND_PORT"
echo ""
echo "  Login Superadmin:"
echo "    Email    : super@lms.id"
echo "    Password : super123"
echo ""
echo "  SETUP CLOUDFLARE:"
echo "  1. Tambah A record: $DOMAIN → $(curl -s ifconfig.me)"
echo "  2. SSL mode: Full (Strict)"
echo "  3. Aktifkan 'Always Use HTTPS'"
echo "  4. Setelah certbot jalan, nyalakan proxy (orange cloud)"
echo ""
echo "  CERTBOT AUTO-RENEW:"
echo "  Cron sudah otomatis via systemd timer."
echo "  Test: certbot renew --dry-run"
echo ""
echo "  PM2: pm2 status / pm2 logs smart-lms"
echo "============================================"
