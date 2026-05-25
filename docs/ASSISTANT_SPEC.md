# SSD Smart Assistant — Intent & Grammar Spec

**Versi:** 1.0
**Tanggal:** Mei 2026
**Engine:** Rule-based parser (no LLM)
**Target response:** < 100ms

---

## 1. Arsitektur

```
User input ─► Tokenizer ─► Intent Matcher ─► Slot Extractor ─► Validator ─► Executor ─► Reply Generator
                              │                  │
                              ▼                  ▼
                        Pattern Library    Synonym Dict
```

**Fallback chain:**
1. Match by exact pattern → 95% confidence
2. Match by fuzzy keyword → ask confirmation
3. No match → suggest top-3 similar intents

**File backend (Go):**
```
backend/internal/assistant/
  ├── parser.go         // Tokenizer + matcher
  ├── intents/          // Per-intent handlers
  │   ├── absensi.go
  │   ├── keuangan.go
  │   ├── komunikasi.go
  │   └── ...
  ├── synonyms.go       // Kamus sinonim
  └── patterns.yaml     // Grammar definitions
```

---

## 2. Notasi Grammar

```
{slot}        = wajib
[slot]        = opsional
(a|b|c)       = pilih salah satu
*             = wildcard / sisa kalimat
@kelas        = entitas terdaftar di DB
@siswa        = nama siswa di DB
@mapel        = mata pelajaran di DB
@tanggal      = parsed date (hari ini, kemarin, 25 Mei, dll)
@bulan        = parsed month
@nominal      = angka rupiah (350rb, 350000, 1.5jt)
```

---

## 3. Kamus Sinonim (Synonym Dictionary)

| Canonical | Sinonim |
|-----------|---------|
| HADIR | masuk, hadir, datang, ada, ikut |
| ALFA | alfa, alpa, bolos, ga masuk, tdk hadir, tidak hadir |
| IZIN | izin, ijin, ga ikut karena, urusan |
| SAKIT | sakit, demam, opname, dirawat |
| TERLAMBAT | telat, terlambat, kesiangan |
| KIRIM_WA | kirim wa, wa-in, broadcast, notif, ingatkan, kabari |
| LIHAT | lihat, cek, tampilkan, show, buka, tunjukkan |
| BUAT | tambah, buat, input, catat, masukkan, simpan |
| HAPUS | hapus, batalkan, cancel, undo, batal |
| LAPORAN | laporan, lapor, rekap, ringkasan, summary |
| SEMUA | semua, all, seluruh, total |
| HARI_INI | hari ini, today, skrg, sekarang |
| KEMARIN | kemarin, kmrn, ystrdy |

---

## 4. Intent Priority — TIER 1 (MVP, 80% pemakaian harian)

### 4.1 ABSEN.BULK_HADIR ⭐⭐⭐
**Use case:** Wali kelas absen sekali tap.

**Patterns:**
```
absen {@kelas} [{@mapel}] semua (HADIR)
{@kelas} [pelajaran {@mapel}] semua masuk
absen {@kelas} hari ini lengkap
```

**Examples:**
- "absen 7A IPA semua hadir"
- "kelas 7A pelajaran IPA semua masuk"
- "absen 8B hari ini lengkap"

**Slot extracted:**
```json
{ "kelas_id": "7A", "mapel_id": "IPA", "tanggal": "2026-05-25", "status": "HADIR" }
```

**Action:** `POST /api/absensi/bulk` with all students = HADIR
**Confirm:** "32 siswa 7A → hadir di IPA. Simpan?"

---

### 4.2 ABSEN.MARK_KECUALI ⭐⭐⭐
**Use case:** Mayoritas hadir, sebut nama yg gak hadir.

**Patterns:**
```
absen {@kelas} [{@mapel}] semua hadir kecuali {@siswa}+ (ALFA|IZIN|SAKIT)
{@kelas} alfa: {@siswa}+
{@kelas} sakit: {@siswa}+, izin: {@siswa}+
```

**Examples:**
- "absen 7A IPA semua hadir kecuali Andi sakit"
- "7A alfa: Andi, Budi"
- "7A sakit Andi, izin Citra"

**Slot:**
```json
{
  "kelas_id":"7A", "mapel_id":"IPA", "tanggal":"2026-05-25",
  "default": "HADIR",
  "kecuali": [
    {"siswa":"Andi","status":"SAKIT"},
    {"siswa":"Budi","status":"ALFA"}
  ]
}
```

---

### 4.3 ABSEN.SINGLE ⭐⭐
**Use case:** Catat 1 siswa.

**Patterns:**
```
{@siswa} [hari ini|@tanggal] (HADIR|ALFA|IZIN|SAKIT|TERLAMBAT)
(IZIN|SAKIT) {@siswa} [{@tanggal}] [karena *]
```

**Examples:**
- "Dimas hari ini sakit"
- "izin Rina kemarin urusan keluarga"
- "Andi alfa"

---

### 4.4 ABSEN.QUERY ⭐⭐
**Patterns:**
```
(rekap|cek) absen {@kelas} [@bulan|@tanggal]
siapa alfa {@tanggal}
siapa alfa {n} hari berturut
```

**Examples:**
- "rekap absen 7A bulan ini"
- "siapa alfa hari ini"
- "siapa alfa 3 hari berturut"

---

### 4.5 SPP.QUERY_TUNGGAKAN ⭐⭐⭐
**Patterns:**
```
siapa (nunggak|tunggakan) [SPP] [> {n} bulan]
tunggakan {@kelas} [{@bulan}]
cek SPP {@siswa}
```

**Examples:**
- "siapa nunggak SPP lebih dari 2 bulan"
- "tunggakan 7A bulan Mei"
- "cek SPP Dimas"

**Action:** Query DB, render list dgn jumlah tunggakan + tombol "WA-in" per row.

---

### 4.6 SPP.BAYAR ⭐⭐
**Patterns:**
```
{@siswa} bayar SPP {@bulan} {@nominal} [(cash|transfer)]
input pembayaran {@siswa} {@nominal}
```

**Examples:**
- "Dimas bayar SPP Mei 350rb cash"
- "Rina bayar 350000 transfer"

**Action:** Insert pembayaran, auto-print kuitansi.

---

### 4.7 WA.NOTIF_ALFA ⭐⭐⭐
**Patterns:**
```
(kirim|broadcast) WA [ke wali] alfa [{@tanggal}|@kelas]
notif alfa
ingatkan wali yg anaknya alfa
```

**Examples:**
- "kirim WA alfa hari ini"
- "notif alfa kelas 7A"

**Action:** Auto-render template "Yth Bpk/Ibu wali {nama}, ananda {nama_siswa} hari ini tidak hadir tanpa keterangan..." → broadcast via Fonnte/Wablas.

---

### 4.8 WA.BROADCAST_KELAS ⭐⭐
**Patterns:**
```
kirim WA ke wali {@kelas}: *
broadcast {@kelas} *
```

**Examples:**
- "kirim WA ke wali 7A: rapat sabtu jam 8 di aula"

**Action:** Broadcast plain text ke nomor wali kelas tsb. Confirm count dulu.

---

### 4.9 LAPORAN.HARIAN ⭐⭐⭐
**Patterns:**
```
(laporan|lapor|rekap) harian [{@tanggal}]
lapor hari ini
```

**Examples:**
- "laporan harian"
- "lap hari ini"

**Action:** Generate PDF: total hadir, alfa, izin, kejadian, pembayaran SPP.

---

### 4.10 LAPORAN.SPP ⭐⭐
**Patterns:**
```
lap(oran)? SPP [{@bulan}] [{@kelas}]
rekap SPP
```

**Examples:**
- "lap SPP Mei"
- "rekap SPP 7A bulan ini"

**Action:** Generate Excel + summary.

---

## 5. Intent Priority — TIER 2 (Fitur lengkap, 6 bulan)

### 5.1 SISWA.CARI / SISWA.PROFIL
```
cari {@siswa}
data {@siswa} [@kelas]
profil {@siswa}
```

### 5.2 SISWA.TAMBAH
```
tambah siswa: {nama}, {@kelas}, NIS {nis}
input siswa baru {nama} {@kelas}
```

### 5.3 SISWA.MUTASI
```
mutasi {@siswa} dari {@kelas} ke {@kelas}
pindahkan {@siswa} ke {@kelas}
```

### 5.4 GURU.TAMBAH
```
tambah guru: {nama} mapel {@mapel}
```

### 5.5 PELANGGARAN.CATAT
```
catat poin {-n} {@siswa} *
{@siswa} pelanggaran *
```

### 5.6 PRESTASI.CATAT
```
catat prestasi {@siswa} *
{@siswa} juara {n} *
```

### 5.7 SP.CETAK
```
cetak SP{n} {@siswa}
buat surat peringatan {@siswa}
```

### 5.8 NILAI.INPUT
```
input nilai (UTS|UAS|tugas) {@mapel} {@kelas}
nilai {@mapel} {@kelas}
```

### 5.9 NILAI.RANGKING
```
rangking {@kelas} [semester {n}]
peringkat {@kelas}
```

### 5.10 RAPORT.CETAK
```
cetak raport {@siswa} [semester {n}]
raport {@kelas}
```

### 5.11 JADWAL.HARI_INI
```
jadwal saya [{@tanggal}]
jadwal {@guru}
```

### 5.12 PIKET.CEK
```
siapa piket [{@tanggal}]
piket hari ini
```

### 5.13 BACKUP
```
backup [database]
backup sekarang
```

---

## 6. Intent Priority — TIER 3 (Power user)

```
- "compare absen 7A vs 7B bulan ini"
- "trend kehadiran 6 bulan"
- "auto: setiap hari jam 17:00 kirim laporan ke kepsek"
- "siswa beresiko DO" (kombinasi alfa + nilai + poin)
- "prediksi tunggakan bulan depan" (statistik, bukan AI)
```

---

## 7. Confirmation & Safety

**Wajib konfirmasi (ada tombol Simpan/Batal):**
- Semua action mutating massal (>5 record): absen bulk, broadcast WA, mutasi
- Semua action irreversible: hapus, SP, laporan ter-publish
- Pembayaran (kuitansi langsung tercetak)

**Auto-execute (tanpa konfirmasi):**
- Query / read-only
- Single record yg bisa di-undo

**Undo support:**
- Setiap mutasi simpan ke `assistant_action_log` dgn `undo_payload`
- "batalkan tadi" / "undo" → rollback action terakhir < 5 menit

---

## 8. Fallback & Help

**Kalo gak match:**
```
Maaf, aku belum ngerti.
Mungkin maksudnya:
  • absen kelas X hadir semua
  • cek tunggakan SPP
  • laporan harian
Ketik /help untuk daftar lengkap.
```

**Slash commands (shortcut):**
```
/help              → daftar intent
/absen <kelas>     → buka grid absensi manual
/wa <kelas>        → buka form broadcast
/lapor             → laporan harian quick
/cari <nama>       → cari siswa
/undo              → batalkan action terakhir
```

---

## 9. Logging & Audit

Setiap parsing ter-log ke tabel `assistant_log`:

```sql
CREATE TABLE assistant_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  raw_input TEXT NOT NULL,
  matched_intent VARCHAR(50),
  parsed_slots JSONB,
  confidence DECIMAL(3,2),
  executed BOOLEAN,
  result JSONB,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Manfaat:
- Audit (siapa kasih perintah apa)
- Improve patterns (lihat input yg sering gagal match)
- Roll-back support

---

## 10. Roadmap Implementasi

**Sprint 1 (1 minggu):** Engine + Intent 4.1, 4.2, 4.3 (absensi)
**Sprint 2 (1 minggu):** Intent 4.5, 4.6 (SPP) + Intent 4.7, 4.8 (WA)
**Sprint 3 (1 minggu):** Intent 4.4, 4.9, 4.10 (query & laporan)
**Sprint 4 (2 minggu):** Tier 2 (5.1-5.13)
**Sprint 5+ (ongoing):** Tier 3 + improve patterns based on log analysis

---

## 11. Implementasi Singkat (Go)

```go
// patterns.yaml (excerpt)
intents:
  - id: ABSEN.BULK_HADIR
    triggers:
      - regex: "^absen\\s+(?P<kelas>\\w+)\\s*(?:pelajaran|mapel)?\\s*(?P<mapel>\\w+)?\\s+semua\\s+(hadir|masuk)$"
      - regex: "^(?P<kelas>\\w+)\\s+pelajaran\\s+(?P<mapel>\\w+)\\s+semua\\s+(hadir|masuk)$"
    confirm: true
    handler: AbsenBulkHadir
```

```go
// parser.go (sketch)
func (p *Parser) Parse(input string) (*Intent, error) {
    norm := p.normalize(input) // lowercase, trim, expand sinonim
    for _, intent := range p.patterns {
        for _, trigger := range intent.Triggers {
            if matches := trigger.Regex.FindStringSubmatch(norm); matches != nil {
                slots := extractNamedGroups(trigger.Regex, matches)
                slots, err := p.resolveEntities(slots) // 7A → kelas_id
                if err != nil {
                    return nil, err
                }
                return &Intent{ID: intent.ID, Slots: slots, Confidence: 0.95}, nil
            }
        }
    }
    return p.suggestSimilar(norm), nil // fallback
}
```

---

## 12. Metrik Sukses

- **Match rate ≥ 85%** dari input pengguna match ke intent (bukan fallback)
- **Avg response < 100ms** dari ketik sampai action card muncul
- **User retention**: ≥ 60% wali kelas pakai assistant minimal 5x/minggu
- **Time saved**: absen 1 kelas dari ~3 menit (manual klik) → ~10 detik (assistant)

---

## 13. Marketing Pitch

> "Assistant SSD bukan AI. Dia robot kecil yg disiplin, hapal 247 perintah,
> dan kerja super cepet karena gak nunggu jawaban dari server jauh.
> Hemat biaya, predictable, dan privasi data terjaga 100% di server sekolah."

— Tagline: **"Bukan pintar. Tapi tepat."**
