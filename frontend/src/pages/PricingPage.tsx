import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  GraduationCap, Check, X, Sparkles, ArrowRight, Shield, Zap, Heart,
  ChevronDown, Phone,
} from 'lucide-react'

const features = {
  included: [
    'Unlimited siswa & guru',
    'Multi-cabang / multi-kampus',
    'Modul absensi anti fake-GPS',
    'Modul akademik (nilai, raport, ujian online)',
    'Modul keuangan (SPP, tagihan, kuitansi PDF)',
    'Notifikasi WA otomatis (BYOK Fonnte/Wablas/Telegram)',
    'AI Hub: generate soal, koreksi otomatis',
    'Parent portal & student portal',
    'Custom logo, kop sekolah, stempel & TTD digital',
    'Backup harian otomatis',
    'SSL / HTTPS',
    'Update fitur baru otomatis',
  ],
  excluded: [
    'Hosting di server sekolah sendiri',
    'Modifikasi source code custom',
  ],
}

type Tone = 'amber' | 'coral' | 'mint' | 'navy'
const supportTone: Record<Tone, { bg: string; text: string }> = {
  amber: { bg: 'bg-amber-soft',    text: 'text-amber-warm' },
  coral: { bg: 'bg-coral/15',      text: 'text-coral' },
  mint:  { bg: 'bg-mint/15',       text: 'text-mint' },
  navy:  { bg: 'bg-navy/10',       text: 'text-navy' },
}

const support: { icon: typeof Heart; title: string; desc: string; tone: Tone }[] = [
  { icon: Heart,  title: 'Setup Gratis',         desc: 'Tim kami import data siswa dari Excel + setup struktur kelas. Selesai dalam 1 hari kerja.', tone: 'amber' },
  { icon: Phone,  title: 'Training Online',      desc: 'Sesi Zoom 2 jam buat admin & guru. Buku panduan PDF + video tutorial.',                     tone: 'coral' },
  { icon: Zap,    title: 'Support WA Prioritas', desc: 'Respon kurang dari 1 jam jam kerja. Bug critical: response time 30 menit.',                tone: 'mint'  },
  { icon: Shield, title: 'SLA 99.9% Uptime',     desc: 'Server cloud dgn backup harian. Data terisolasi per sekolah, kompatibel UU PDP.',           tone: 'navy'  },
]

const pricingFAQs = [
  {
    q: 'Apakah harga ini per siswa atau flat?',
    a: 'Flat Rp 3 juta per tahun untuk SATU sekolah, tanpa batas jumlah siswa. Mau 50 siswa atau 5.000 siswa, harga sama.',
  },
  {
    q: 'Bagaimana kalau sekolah saya punya cabang?',
    a: 'Multi-cabang sudah include. Satu lisensi cover semua cabang dalam satu yayasan/lembaga, dgn dashboard terpisah per cabang.',
  },
  {
    q: 'Apakah ada free trial?',
    a: 'Ada. 14 hari free trial, no credit card required. Lo bisa coba semua fitur, import data siswa real, dan keputusan beli setelah trial selesai.',
  },
  {
    q: 'Bagaimana cara bayar?',
    a: 'Transfer bank (BCA/Mandiri/BSI) atau QRIS. Invoice akan kami kirim setelah konfirmasi. Pembayaran tahunan di muka.',
  },
  {
    q: 'Bisa berhenti kapan aja?',
    a: 'Bisa. Tidak ada kontrak terkunci. Kalau lo cancel di tengah tahun, kami pro-rate refund 70% sisa periode.',
  },
  {
    q: 'Apakah ada biaya tersembunyi?',
    a: 'Tidak ada. Notifikasi WA pakai akun lo sendiri (Fonnte/Wablas), jadi biaya kirim WA langsung ke provider. SSD hanya cas biaya tahunan.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-cream/80 border-b border-warm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-navy">
            <div className="w-9 h-9 rounded-xl gradient-warm flex items-center justify-center shadow-warm-sm">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold">SSD</div>
              <div className="text-[10px] text-amber-warm -mt-0.5">Smart System Digital</div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link to="/" className="text-navy/70 hover:text-navy transition">Beranda</Link>
            <Link to="/#features" className="text-navy/70 hover:text-navy transition">Fitur</Link>
            <Link to="/#testimoni" className="text-navy/70 hover:text-navy transition">Testimoni</Link>
            <a href="#faq" className="text-amber-warm font-semibold">Harga</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-navy/70 hover:text-navy transition">Masuk</Link>
            <a href="#contact" className="text-sm gradient-warm text-white px-4 py-2 rounded-lg font-semibold hover:opacity-95 transition shadow-warm-sm">
              Hubungi Sales
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-12 px-6 relative">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-amber-tint rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute top-40 right-0 w-96 h-96 bg-coral rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center relative"
        >
          <div className="inline-flex items-center gap-2 bg-amber-soft border border-amber-tint px-4 py-2 rounded-full text-sm text-amber-warm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Harga Sederhana &mdash; Satu Paket Lengkap</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-navy leading-[1.05]">
            Satu harga.<br />
            <span className="bg-gradient-to-r from-amber-warm via-coral to-rose bg-clip-text text-transparent">
              Semua fitur.
            </span>
          </h1>
          <p className="text-xl text-navy/65 max-w-2xl mx-auto leading-relaxed">
            Tidak ada tier membingungkan, tidak ada add-on tersembunyi. Bayar sekali setahun, semua modul terbuka.
          </p>
        </motion.div>
      </section>

      {/* PRICING CARD */}
      <section className="px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative">
            {/* Glow */}
            <div className="absolute -inset-4 gradient-warm rounded-3xl opacity-25 blur-2xl" />

            <div className="relative bg-white border border-warm rounded-3xl p-8 md:p-10 overflow-hidden shadow-card-lg">
              <div className="absolute top-0 right-0 gradient-warm text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl shadow-warm-sm">
                PALING POPULER
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-extrabold mb-2 text-navy">Paket Lengkap</h3>
                <p className="text-navy/60">Untuk SD, SMP, SMA, MA, Pesantren, atau lembaga pendidikan apapun.</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-amber-warm to-coral bg-clip-text text-transparent">
                    Rp 3jt
                  </span>
                  <span className="text-navy/55 text-lg font-medium">/ tahun</span>
                </div>
                <p className="text-sm text-navy/55 mt-2">
                  Setara <strong className="text-navy">Rp 250rb / bulan</strong>. Tanpa batas jumlah siswa.
                </p>
              </div>

              <a
                href="#contact"
                className="group flex items-center justify-center gap-2 w-full gradient-warm text-white px-8 py-4 rounded-xl font-bold text-lg transition shadow-warm hover:opacity-95 mb-8"
              >
                Mulai Trial 14 Hari Gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </a>

              <div className="space-y-3 border-t border-warm pt-8">
                <div className="text-sm font-bold text-navy mb-4">Yang Anda dapat:</div>
                {features.included.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-mint/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-mint" strokeWidth={3} />
                    </div>
                    <span className="text-navy/80 text-sm">{f}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-warm pt-8 mt-8">
                <div className="text-sm font-bold text-navy/55 mb-4">Tidak termasuk:</div>
                {features.excluded.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-navy/40" strokeWidth={3} />
                    </div>
                    <span className="text-navy/55 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SUPPORT */}
      <section className="py-20 px-6 bg-cream-soft border-y border-warm">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">Yang Lo Dapat</div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-navy">Yang termasuk dalam langganan</h2>
            <p className="text-navy/60 max-w-2xl mx-auto leading-relaxed">
              Bukan cuma software. Lo dapet support, training, dan tim yang ngerti ribetnya manage sekolah.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {support.map((s, i) => {
              const t = supportTone[s.tone]
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white border border-warm rounded-2xl p-6 shadow-card hover:shadow-card-lg transition"
                >
                  <div className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center mb-4`}>
                    <s.icon className={`w-5 h-5 ${t.text}`} strokeWidth={2.3} />
                  </div>
                  <h3 className="font-bold mb-2 text-navy">{s.title}</h3>
                  <p className="text-sm text-navy/60 leading-relaxed">{s.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* DEMO CTA */}
      <section id="contact" className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto relative overflow-hidden gradient-navy text-white rounded-3xl p-10 md:p-14 shadow-card-lg"
        >
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-amber-warm rounded-full mix-blend-overlay filter blur-3xl opacity-40 pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-coral rounded-full mix-blend-overlay filter blur-3xl opacity-30 pointer-events-none" />
          <div className="grid md:grid-cols-2 gap-10 items-center relative">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Mau coba dulu?</h2>
              <p className="text-white/75 mb-6 leading-relaxed">
                Login akun demo dgn data dummy lengkap (90 siswa, 3 kelas, 270 tagihan).
                Eksplor semua fitur tanpa daftar.
              </p>
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 font-mono text-sm space-y-1">
                <div><span className="text-white/55">Email:</span> <span className="text-amber-warm font-semibold">admin@demo.lms.id</span></div>
                <div><span className="text-white/55">Password:</span> <span className="text-amber-warm font-semibold">demo123</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/login"
                className="group gradient-warm text-white px-6 py-4 rounded-xl font-bold text-center transition flex items-center justify-center gap-2 shadow-warm hover:opacity-95"
              >
                Coba Demo Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <a
                href="https://wa.me/628123456789?text=Halo,%20saya%20tertarik%20SSD%20-%20Smart%20System%20Digital"
                className="bg-mint hover:bg-mint/90 text-white px-6 py-4 rounded-xl font-bold text-center transition flex items-center justify-center gap-2 shadow-warm-sm"
              >
                <Phone className="w-5 h-5" />
                Chat WA Sales
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <div className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy">FAQ Harga</h2>
          </motion.div>
          <div className="space-y-3">
            {pricingFAQs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white border border-warm rounded-xl overflow-hidden shadow-card"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-cream-soft transition list-none">
                  <span className="font-semibold pr-4 text-navy">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-amber-warm flex-shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-navy/65 leading-relaxed">{faq.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-warm py-10 px-6 text-sm text-navy/55 text-center bg-cream-soft">
        &copy; 2026 SSD &mdash; Smart System Digital. All rights reserved.
        <span className="mx-3 text-navy/30">&middot;</span>
        <Link to="/" className="hover:text-amber-warm transition">Beranda</Link>
        <span className="mx-3 text-navy/30">&middot;</span>
        <Link to="/login" className="hover:text-amber-warm transition">Login</Link>
      </footer>
    </div>
  )
}
