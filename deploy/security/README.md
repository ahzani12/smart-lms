# Smart-LMS Security Stack

Defense in depth: nginx rate limit → Go fiber limiter → fail2ban firewall ban.

## Arsitektur

```
Internet
   ↓
[fail2ban iptables] ← ban IP bermasalah (24 jam SSH, 30 menit login spam)
   ↓
[nginx :3008]
  ├─ rate limit: general 30/s, API 10/s, login 5/menit
  ├─ connection limit: 50 per IP
  ├─ block scanner paths (.env, .git, wp-admin, dll)
  └─ security headers (XSS, clickjacking, MIME sniffing)
   ↓
[Go fiber :8085]
  ├─ global limiter: 200 req/menit per IP
  └─ auth limiter: 5 attempts/menit untuk /api/auth/login & /register
```

## Files

| File | Target |
|---|---|
| `nginx-smart-lms.conf` | `/etc/nginx/sites-available/smart-lms` |
| `nginx-rate-limit-zones.conf` | `/etc/nginx/conf.d/rate-limit-zones.conf` |
| `fail2ban-jail.conf` | `/etc/fail2ban/jail.d/smart-lms.conf` |
| `fail2ban-filter-*.conf` | `/etc/fail2ban/filter.d/*.conf` |

## Deployment

Ada di file `install-security.sh` di folder ini.

## Verify

```bash
# Status fail2ban jails
fail2ban-client status
fail2ban-client status smart-lms-login
fail2ban-client banned

# Test rate limit (lokal)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3008/api/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x","password":"x"}'
done
# Expected: 401, 401, 401, 429, 429, 429, 429, 429, 429, 429

# Unban IP (kalau lo sendiri kena)
fail2ban-client set smart-lms-login unbanip 1.2.3.4
```

## Whitelist IP Lo Sendiri

Edit `/etc/fail2ban/jail.local`:
```ini
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 YOUR.IP.HERE
```
Lalu `systemctl restart fail2ban`.
