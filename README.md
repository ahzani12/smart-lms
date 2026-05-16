# Smart LMS (Sistem Digital Sekolah)

Sistem manajemen pembelajaran (LMS) multi-tenant untuk sekolah. Mendukung multiple sekolah dalam satu instalasi dengan isolasi data per sekolah.

## Fitur

### Multi-Tenant
- Satu instalasi untuk banyak sekolah
- Isolasi data antar sekolah (sekolah A tidak bisa akses data sekolah B)
- Superadmin mengelola semua sekolah dari satu dashboard

### Role & Akses
| Role | Login Pakai | Akses |
|------|-------------|-------|
| Superadmin | Email | Kelola sekolah, kelola admin, overview semua data |
| Admin Sekolah | Email | Kelola data sekolah sendiri (guru, siswa, mapel, dll) |
| Guru | NIP | Bank soal, ujian, penilaian, absensi |
| Siswa | Student ID (6 digit) | Mengerjakan ujian, lihat nilai |
| Orang Tua | Kode Akses | Monitoring nilai & absensi anak |

### Modul
- **Dashboard** — Statistik sekolah (siswa, guru, ujian, kelulusan)
- **Bank Soal** — Buat soal (pilihan ganda, essay, true/false) dengan gambar
- **Ujian Online** — CBT dengan timer, auto-submit, anti-cheat
- **Penilaian** — Komponen nilai (tugas, UTS, UAS) dengan bobot
- **Raport** — Generate raport per semester
- **Absensi** — Rekap kehadiran siswa
- **Manajemen** — CRUD guru, siswa, kelas, mapel, semester
- **Parent Portal** — Orang tua monitoring via kode akses
- **AI Hub** — Integrasi AI untuk generate soal
- **Leaderboard** — Ranking siswa per kelas/sekolah

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Go 1.22+ / Fiber v2 / GORM |
| Database | PostgreSQL 14+ |
| Frontend | React 18 / TypeScript / Tailwind CSS / shadcn/ui |
| Process Manager | PM2 |
| Web Server | Nginx |
| SSL | Let's Encrypt (Certbot) |

## Struktur Project

```
smart-lms/
├── backend/
│   ├── main.go                 # Entry point
│   ├── go.mod / go.sum
│   └── internal/
│       ├── handlers/           # HTTP handlers per modul
│       ├── models/             # GORM models + seed
│       ├── middleware/         # Auth JWT, CORS, school isolation
│       └── routes/             # Route definitions
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components per role
│   │   ├── context/            # AuthContext
│   │   └── lib/                # API client, utils
│   ├── package.json
│   └── vite.config.ts
├── install.sh                  # One-click installer
└── README.md
```

## Instalasi

### Prasyarat
- Ubuntu 20.04+ / Debian 11+
- RAM minimal 2GB
- Domain yang sudah pointing ke IP server

### Quick Install (Recommended)

```bash
git clone https://github.com/YOUR_USERNAME/smart-lms.git
cd smart-lms
bash install.sh
```

Script akan meminta:
1. **Domain** — contoh: `lms.sekolahku.id`
2. **Password Database** — password untuk PostgreSQL

Script otomatis:
- Install dependencies (Nginx, PostgreSQL, Node.js, Go, PM2)
- Setup database
- Build backend & frontend
- Konfigurasi Nginx
- Install SSL via Certbot
- Seed superadmin

### Manual Install

#### 1. Clone & Setup Database

```bash
git clone https://github.com/YOUR_USERNAME/smart-lms.git
cd smart-lms

# PostgreSQL
sudo -u postgres psql -c "CREATE USER smart_lms_admin WITH PASSWORD 'PASSWORD_KAMU';"
sudo -u postgres psql -c "CREATE DATABASE smart_lms OWNER smart_lms_admin;"
```

#### 2. Backend

```bash
cd backend

# Buat .env
cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=smart_lms_admin
DB_PASSWORD=PASSWORD_KAMU
DB_NAME=smart_lms
JWT_SECRET=$(openssl rand -hex 32)
PORT=8085
EOF

# Build & run
go build -o smart-lms .
pm2 start ./smart-lms --name smart-lms
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run build

# Copy ke web root
sudo mkdir -p /var/www/smart-lms
sudo cp -r dist/* /var/www/smart-lms/
```

#### 4. Nginx

```nginx
server {
    listen 80;
    server_name lms.sekolahku.id;

    client_max_body_size 50m;
    root /var/www/smart-lms;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/smart-lms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### 5. SSL (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d lms.sekolahku.id --redirect
```

#### 6. Cloudflare (Opsional)

Jika pakai Cloudflare:
1. Tambah A record: `lms.sekolahku.id` → IP server
2. **Saat install certbot**: matikan proxy (grey cloud) dulu
3. Setelah certbot berhasil: nyalakan proxy (orange cloud)
4. SSL mode: **Full (Strict)**
5. Aktifkan "Always Use HTTPS"

## Penggunaan

### Login Pertama Kali

Setelah instalasi, login sebagai superadmin:
- **Email**: `super@lms.id`
- **Password**: `super123`

> ⚠️ Segera ganti password setelah login pertama!

### Alur Setup Sekolah Baru

1. **Login Superadmin** → Kelola Sekolah → Tambah Sekolah
2. **Buat Admin** → Kelola Admin → Tambah Admin (pilih sekolah)
3. **Login Admin Sekolah** → Setup data:
   - Tambah Semester (set aktif)
   - Tambah Mata Pelajaran
   - Tambah Kelas
   - Tambah Guru (assign mapel & kelas)
   - Tambah Siswa (assign kelas)
4. **Guru login** → Buat soal & ujian
5. **Siswa login** → Kerjakan ujian

### Login Per Role

| Role | URL | Credential |
|------|-----|-----------|
| Superadmin | `/login` | Email + password |
| Admin | `/login` | Email + password |
| Guru | `/login` | NIP + password |
| Siswa | `/login` | Student ID (6 digit) + password |
| Orang Tua | `/parent` | Kode akses (dari admin) |

### Fitur Ujian

- **Tipe soal**: Pilihan ganda, essay, true/false
- **Timer**: Auto-submit saat waktu habis
- **Acak soal**: Urutan soal diacak per siswa
- **Review**: Guru bisa review jawaban essay
- **Nilai otomatis**: Pilihan ganda & true/false dinilai otomatis

### Komponen Penilaian

Admin/Guru bisa set komponen nilai:
- Tugas Harian (bobot: 30%)
- UTS (bobot: 30%)
- UAS (bobot: 40%)

Bobot bisa diatur per sekolah.

### Parent Portal

1. Admin generate kode akses untuk siswa
2. Orang tua akses `/parent` + masukkan kode
3. Bisa lihat: nilai, absensi, jadwal ujian

## API Endpoints

### Auth
```
POST /api/auth/login          # Login (email/NIP/student_id + password)
GET  /api/auth/me             # Get current user
```

### Superadmin
```
GET    /api/super/overview    # Stats semua sekolah
GET    /api/super/schools     # List sekolah
POST   /api/super/schools     # Tambah sekolah
PUT    /api/super/schools/:id # Edit sekolah
DELETE /api/super/schools/:id # Hapus sekolah
GET    /api/super/admins      # List admin (filter ?school_id=)
POST   /api/super/admins      # Tambah admin
PUT    /api/super/admins/:id  # Edit admin
DELETE /api/super/admins/:id  # Hapus admin
POST   /api/super/admins/:id/reset-password  # Reset password
```

### Sekolah (Admin/Guru)
```
GET/POST/PUT/DELETE /api/teachers     # CRUD Guru
GET/POST/PUT/DELETE /api/students     # CRUD Siswa
GET/POST/PUT/DELETE /api/classes      # CRUD Kelas
GET/POST/PUT/DELETE /api/subjects     # CRUD Mapel
GET/POST/PUT/DELETE /api/semesters    # CRUD Semester
GET/POST/PUT/DELETE /api/exams        # CRUD Ujian
GET/POST/PUT/DELETE /api/questions    # CRUD Soal
```

### Ujian (Siswa)
```
GET  /api/student/exams              # List ujian tersedia
POST /api/student/exams/:id/start    # Mulai ujian
POST /api/student/exams/:id/answer   # Submit jawaban
POST /api/student/exams/:id/finish   # Selesai ujian
GET  /api/student/exams/:id/result   # Lihat hasil
```

## Maintenance

### PM2 Commands
```bash
pm2 status              # Cek status
pm2 logs smart-lms      # Lihat log
pm2 restart smart-lms   # Restart backend
```

### Update Aplikasi
```bash
cd /root/smart-lms
git pull

# Rebuild backend
cd backend && go build -o smart-lms . && pm2 restart smart-lms

# Rebuild frontend
cd ../frontend && npm run build && cp -r dist/* /var/www/smart-lms/
```

### Backup Database
```bash
pg_dump -U smart_lms_admin smart_lms > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
psql -U smart_lms_admin smart_lms < backup_20260516.sql
```

### SSL Renewal
Certbot auto-renew via systemd timer. Test manual:
```bash
certbot renew --dry-run
```

## Environment Variables

| Variable | Default | Keterangan |
|----------|---------|-----------|
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_USER | smart_lms_admin | Database user |
| DB_PASSWORD | - | Database password |
| DB_NAME | smart_lms | Database name |
| JWT_SECRET | - | Secret untuk JWT token |
| PORT | 8085 | Backend port |

## Troubleshooting

### Backend tidak start
```bash
pm2 logs smart-lms --lines 50
# Cek koneksi DB
PGPASSWORD=xxx psql -h localhost -U smart_lms_admin -d smart_lms -c "SELECT 1"
```

### 502 Bad Gateway
```bash
# Cek backend running
pm2 status
# Cek nginx config
nginx -t
```

### Login gagal
```bash
# Cek user di DB
PGPASSWORD=xxx psql -h localhost -U smart_lms_admin -d smart_lms \
  -c "SELECT id, email, role, active FROM users;"
```

### SSL certificate expired
```bash
certbot renew --force-renewal
systemctl reload nginx
```

## License

MIT

## Contributing

1. Fork repo
2. Buat branch: `git checkout -b fitur-baru`
3. Commit: `git commit -m "Tambah fitur X"`
4. Push: `git push origin fitur-baru`
5. Buat Pull Request
