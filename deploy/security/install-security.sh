#!/bin/bash
# Smart-LMS Security Stack Installer
# Usage: bash install-security.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔒 Installing Smart-LMS security stack..."

# 1. fail2ban
if ! command -v fail2ban-client &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq fail2ban
fi

# 2. nginx config
sudo cp "$DIR/nginx-rate-limit-zones.conf" /etc/nginx/conf.d/rate-limit-zones.conf
sudo cp "$DIR/nginx-smart-lms.conf" /etc/nginx/sites-available/smart-lms
sudo ln -sf /etc/nginx/sites-available/smart-lms /etc/nginx/sites-enabled/smart-lms
sudo nginx -t && sudo systemctl reload nginx

# 3. fail2ban filters
sudo cp "$DIR/fail2ban-filter-login.conf"     /etc/fail2ban/filter.d/smart-lms-login.conf
sudo cp "$DIR/fail2ban-filter-ratelimit.conf" /etc/fail2ban/filter.d/nginx-ratelimit-spam.conf
sudo cp "$DIR/fail2ban-filter-scanner.conf"   /etc/fail2ban/filter.d/nginx-scanner.conf
sudo cp "$DIR/fail2ban-filter-limitreq.conf"  /etc/fail2ban/filter.d/nginx-limit-req.conf

# 4. fail2ban jail
sudo cp "$DIR/fail2ban-jail.conf" /etc/fail2ban/jail.d/smart-lms.conf

# 5. Start
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban

echo "✅ Done!"
echo
fail2ban-client status
