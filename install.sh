#!/bin/bash
set -e

# ════════════════════════════════════════════════════════
#   SSD (Smart-LMS) — One-Click Installer
#   Stack: Go + Fiber + PostgreSQL + React + Nginx + PM2
#   Security: rate limit + fail2ban (defense-in-depth)
# ════════════════════════════════════════════════════════

# ─── Flags ───
SKIP_DEPS=0
SKIP_SSL=0
SKIP_SECURITY=0
for arg in "$@"; do
  case "$arg" in
    --skip-deps)     SKIP_DEPS=1 ;;
    --skip-ssl)      SKIP_SSL=1 ;;
    --skip-security) SKIP_SECURITY=1 ;;
    -h|--help)
      cat <<HELP
Usage: $0 [options]

Options:
  --skip-deps      Skip apt/node/go/pm2 install (kalau sudah ada)
  --skip-ssl       Skip Let's Encrypt cert (kalau pakai Cloudflare proxy)
  --skip-security  Skip rate limit + fail2ban setup
  -h, --help       Show this help
HELP
      exit 0
      ;;
  esac
done

cat <<'BANNER'
════════════════════════════════════════════════════════
  SSD — Sistem Sekolah Digital
  One-Click Installer
════════════════════════════════════════════════════════
BANNER
echo

# ─── Input ───
read -p "Domain (contoh: lms.sekolahku.id): " DOMAIN
[ -z "$DOMAIN" ] && { echo "❌ Domain wajib diisi"; exit 1; }

# Generate password kalau user gak isi
read -p "DB Password (kosongkan = auto-generate): " DB_PASS
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  echo "    🔑 Auto-generated DB password: $DB_PASS"
fi

read -p "Email untuk SSL cert (opsional, untuk notif renewal): " SSL_EMAIL

echo

# ─── Defaults ───
DB_NAME="smart_lms"
DB_USER="smart_lms_admin"
BACKEND_PORT=8085
FRONTEND_DIR="/var/www/smart-lms"
BACKEND_DIR="/root/smart-lms/backend"
FRONTEND_SRC="/root/smart-lms/frontend"
SECURITY_DIR="/root/smart-lms/deploy/security"

echo "  Domain        : $DOMAIN"
echo "  Database      : $DB_NAME / $DB_USER"
echo "  Backend port  : $BACKEND_PORT"
echo "  Frontend dir  : $FRONTEND_DIR"
echo
read -p "Lanjut? (y/n): " CONFIRM
[ "$CONFIRM" != "y" ] && exit 0

TOTAL_STEPS=8
[ $SKIP_SECURITY -eq 0 ] && TOTAL_STEPS=$((TOTAL_STEPS+1))
[ $SKIP_SSL -eq 0 ] && TOTAL_STEPS=$((TOTAL_STEPS+1))
STEP=0

# ════════════════════════════════════════════════════════
# 1. Dependencies
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Installing dependencies..."

if [ $SKIP_DEPS -eq 0 ]; then
  apt-get update -qq
  apt-get install -y -qq nginx postgresql postgresql-contrib curl gnupg2 openssl > /dev/null 2>&1

  if ! command -v node &> /dev/null; then
    echo "    Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
  fi

  if ! command -v go &> /dev/null; then
    echo "    Installing Go 1.22..."
    wget -q https://go.dev/dl/go1.22.4.linux-amd64.tar.gz -O /tmp/go.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    grep -q "/usr/local/go/bin" /root/.bashrc || echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
  fi

  if ! command -v pm2 &> /dev/null; then
    echo "    Installing PM2..."
    npm install -g pm2 > /dev/null 2>&1
  fi
else
  echo "    (skipped via --skip-deps)"
fi
echo "    ✅ Done."

# ════════════════════════════════════════════════════════
# 2. PostgreSQL
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Setting up PostgreSQL..."

# Idempotent: cek dulu sebelum create
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")
if [ "$USER_EXISTS" = "1" ]; then
  echo "    User exists, updating password..."
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
else
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
fi

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")
if [ "$DB_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" > /dev/null 2>&1
echo "    ✅ Done."

# ════════════════════════════════════════════════════════
# 3. Backend env + build
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Building backend..."
cd "$BACKEND_DIR"

JWT_SECRET=$(openssl rand -hex 32)

# Idempotent: kalau .env udah ada, preserve JWT_SECRET (jangan invalidate token user)
if [ -f .env ]; then
  EXISTING_JWT=$(grep '^JWT_SECRET=' .env | cut -d= -f2)
  [ -n "$EXISTING_JWT" ] && JWT_SECRET="$EXISTING_JWT"
  cp .env ".env.bak.$(date +%s)"
  echo "    Existing .env backed up"
fi

cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=$BACKEND_PORT
GIN_MODE=release
EOF
chmod 600 .env

# Build
echo "    Compiling Go binary..."
export PATH=$PATH:/usr/local/go/bin
go build -o smart-lms . 2>&1 | tail -5
[ -x ./smart-lms ] || { echo "❌ Build failed"; exit 1; }
echo "    ✅ Done."

# ════════════════════════════════════════════════════════
# 4. Frontend build
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Building frontend..."
cd "$FRONTEND_SRC"

if [ ! -d node_modules ]; then
  echo "    Installing npm packages..."
  npm install --silent 2>&1 | tail -3
fi

npm run build 2>&1 | tail -3
[ -d dist ] || { echo "❌ Frontend build failed"; exit 1; }

mkdir -p "$FRONTEND_DIR"
rsync -a --delete dist/ "$FRONTEND_DIR/"
echo "    ✅ Done."

# ════════════════════════════════════════════════════════
# 5. PM2 (pakai ecosystem config biar .env ke-load)
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Setting up PM2..."

cd "$BACKEND_DIR"

# Generate ecosystem.config.js — PM2 bakal inject .env vars ke process
cat > ecosystem.config.js <<'ECOEOF'
// Auto-generated by install.sh
// PM2 reads .env file from BACKEND_DIR and injects to process env
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });
}

module.exports = {
  apps: [{
    name: 'smart-lms',
    script: './smart-lms',
    cwd: __dirname,
    env,
    autorestart: true,
    max_memory_restart: '500M',
    error_file: '/root/.pm2/logs/smart-lms-error.log',
    out_file: '/root/.pm2/logs/smart-lms-out.log',
    time: true,
  }],
};
ECOEOF

pm2 delete smart-lms 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true

# Verify backend up
sleep 3
if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT"; then
  echo "    ✅ Backend listening on :$BACKEND_PORT"
else
  echo "    ⚠️  Backend not listening, check: pm2 logs smart-lms"
  pm2 logs smart-lms --lines 5 --nostream 2>&1 | tail -10
fi

# ════════════════════════════════════════════════════════
# 6. Nginx
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Configuring Nginx..."

# Backup existing kalau ada
if [ -f /etc/nginx/sites-available/smart-lms ]; then
  cp /etc/nginx/sites-available/smart-lms "/etc/nginx/sites-available/smart-lms.bak.$(date +%s)"
fi

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

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
    }
}
NGINX

# Cleanup backup files dari sites-enabled (nginx ke-load semua di sana)
rm -f /etc/nginx/sites-enabled/smart-lms.bak.*

ln -sf /etc/nginx/sites-available/smart-lms /etc/nginx/sites-enabled/smart-lms
nginx -t 2>&1 | grep -v "warn" | tail -2
systemctl reload nginx
echo "    ✅ Done."

# ════════════════════════════════════════════════════════
# 7. SSL
# ════════════════════════════════════════════════════════
if [ $SKIP_SSL -eq 0 ]; then
  STEP=$((STEP+1))
  echo
  echo "[$STEP/$TOTAL_STEPS] Obtaining SSL certificate..."
  echo "    ⚠️  Domain HARUS sudah pointing ke IP server ini!"
  echo "    Kalau pakai Cloudflare: matikan proxy (grey cloud) dulu."
  echo
  read -p "    Domain sudah pointing ke IP ini? (y/n): " SSL_CONFIRM

  if [ "$SSL_CONFIRM" = "y" ]; then
    apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1

    if [ -n "$SSL_EMAIL" ]; then
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
    else
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
    fi
    echo "    ✅ SSL installed. Auto-renew via systemd timer."
  else
    echo "    Skipped. Run manual nanti:"
    echo "    certbot --nginx -d $DOMAIN --redirect"
  fi
else
  echo "    (SSL skipped via --skip-ssl)"
fi

# ════════════════════════════════════════════════════════
# 8. Security Stack (rate limit + fail2ban)
# ════════════════════════════════════════════════════════
if [ $SKIP_SECURITY -eq 0 ]; then
  STEP=$((STEP+1))
  echo
  echo "[$STEP/$TOTAL_STEPS] Installing security stack (rate limit + fail2ban)..."

  if [ -f "$SECURITY_DIR/install-security.sh" ]; then
    bash "$SECURITY_DIR/install-security.sh" 2>&1 | tail -10
    echo "    ✅ Defense-in-depth aktif"
  else
    echo "    ⚠️  $SECURITY_DIR/install-security.sh tidak ditemukan"
    echo "    Skip security stack — pasang manual nanti."
  fi
else
  echo "    (security skipped via --skip-security)"
fi

# ════════════════════════════════════════════════════════
# 9. Wait for seed (backend auto-seeds superadmin via models.SeedData)
# ════════════════════════════════════════════════════════
STEP=$((STEP+1))
echo
echo "[$STEP/$TOTAL_STEPS] Verifying superadmin seed..."

# Backend code (internal/models/seed.go) auto-creates super@lms.id pada startup
sleep 2
SUPER_EXISTS=$(PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT 1 FROM users WHERE email='super@lms.id' LIMIT 1" 2>/dev/null)

if [ "$SUPER_EXISTS" = "1" ]; then
  echo "    ✅ Superadmin sudah ada (super@lms.id)"
else
  echo "    ⚠️  Superadmin belum ke-seed. Cek log: pm2 logs smart-lms"
fi

# ════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════
SERVER_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
PROTO="http"
[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ] && PROTO="https"

cat <<DONE

════════════════════════════════════════════════════════
  ✅ INSTALASI SELESAI
════════════════════════════════════════════════════════

  URL          : $PROTO://$DOMAIN
  Backend      : http://127.0.0.1:$BACKEND_PORT
  Server IP    : $SERVER_IP

  Login Superadmin:
    Email      : super@lms.id
    Password   : super123 (GANTI SEGERA dari dashboard!)

  Database:
    Name       : $DB_NAME
    User       : $DB_USER
    Password   : (saved in $BACKEND_DIR/.env, chmod 600)

  CLOUDFLARE SETUP:
    1. A record: $DOMAIN → $SERVER_IP
    2. SSL mode: Full (Strict)
    3. Aktifkan "Always Use HTTPS"
    4. Setelah certbot OK, nyalakan proxy (orange cloud)

  USEFUL COMMANDS:
    pm2 status                       # cek backend
    pm2 logs smart-lms               # tail logs
    pm2 restart smart-lms            # restart
    fail2ban-client status           # cek banned IPs
    certbot renew --dry-run          # test SSL renewal

  RE-RUN:
    bash install.sh --skip-deps      # update tanpa reinstall deps
    bash install.sh --skip-ssl       # update tanpa SSL
    bash install.sh --skip-security  # update tanpa fail2ban

════════════════════════════════════════════════════════
DONE
