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

const support = [
  { icon: Heart, title: 'Setup Gratis', desc: 'Tim kami import data siswa dari Excel + setup struktur kelas. Selesai dalam 1 hari kerja.' },
  { icon: Phone, title: 'Training Online', desc: 'Sesi Zoom 2 jam buat admin & guru. Buku panduan PDF + video tutorial.' },
  { icon: Zap, title: 'Support WA Prioritas', desc: 'Respon kurang dari 1 jam jam kerja. Bug critical: response time 30 menit.' },
  { icon: Shield, title: 'SLA 99.9% Uptime', desc: 'Server cloud dgn backup harian. Data terisolasi per sekolah, kompatibel UU PDP.' },
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
    a: 'Tidak ada. Notifikasi WA pakai akun lo sendiri (Fonnte/Wablas), jadi biaya kirim WA langsung ke provider. Smart-LMS hanya cas biaya tahunan.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span>Smart-LMS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <Link to="/" className="text-slate-300 hover:text-white transition">Beranda</Link>
            <Link to="/#features" className="text-slate-300 hover:text-white transition">Fitur</Link>
            <Link to="/#testimoni" className="text-slate-300 hover:text-white transition">Testimoni</Link>
            <a href="#faq" className="text-white">Harga</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition">Masuk</Link>
            <a href="#contact" className="text-sm bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100 transition">
              Hubungi Sales
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm text-slate-300 mb-8">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Harga Sederhana &mdash; Satu Paket Lengkap</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Satu harga.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Semua fitur.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
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
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-30 blur-2xl" />

            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl">
                PALING POPULER
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Paket Lengkap</h3>
                <p className="text-slate-400">Untuk SD, SMP, SMA, MA, Pesantren, atau lembaga pendidikan apapun.</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Rp 3jt
                  </span>
                  <span className="text-slate-400 text-lg">/ tahun</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Setara <strong className="text-slate-300">Rp 250rb / bulan</strong>. Tanpa batas jumlah siswa.
                </p>
              </div>

              <a
                href="#contact"
                className="group flex items-center justify-center gap-2 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-8 py-4 rounded-xl font-bold text-lg transition shadow-2xl shadow-purple-500/30 mb-8"
              >
                Mulai Trial 14 Hari Gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </a>

              <div className="space-y-3 border-t border-white/10 pt-8">
                <div className="text-sm font-semibold text-slate-300 mb-4">Yang Anda dapat:</div>
                {features.included.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-slate-300 text-sm">{f}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-white/10 pt-8 mt-8">
                <div className="text-sm font-semibold text-slate-500 mb-4">Tidak termasuk:</div>
                {features.excluded.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-slate-500" />
                    </div>
                    <span className="text-slate-500 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SUPPORT */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Yang termasuk dalam langganan</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Bukan cuma software. Lo dapet support, training, dan tim yang ngerti ribetnya manage sekolah.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {support.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO CTA */}
      <section id="contact" className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-3xl p-10 md:p-14"
        >
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Mau coba dulu?</h2>
              <p className="text-slate-400 mb-6">
                Login akun demo dgn data dummy lengkap (90 siswa, 3 kelas, 270 tagihan).
                Eksplor semua fitur tanpa daftar.
              </p>
              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 font-mono text-sm space-y-1">
                <div><span className="text-slate-500">Email:</span> <span className="text-emerald-400">admin@demo.lms.id</span></div>
                <div><span className="text-slate-500">Password:</span> <span className="text-emerald-400">demo123</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/login"
                className="group bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-6 py-4 rounded-xl font-bold text-center transition flex items-center justify-center gap-2"
              >
                Coba Demo Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <a
                href="https://wa.me/628123456789?text=Halo,%20saya%20tertarik%20Smart-LMS"
                className="bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-xl font-bold text-center transition flex items-center justify-center gap-2"
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
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-10"
          >
            FAQ Harga
          </motion.h2>
          <div className="space-y-3">
            {pricingFAQs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5 transition list-none">
                  <span className="font-semibold pr-4">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 flex-shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-slate-400 leading-relaxed">{faq.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-10 px-6 text-sm text-slate-500 text-center">
        &copy; 2026 Smart-LMS. All rights reserved.
        <span className="mx-3">&middot;</span>
        <Link to="/" className="hover:text-white">Beranda</Link>
        <span className="mx-3">&middot;</span>
        <Link to="/login" className="hover:text-white">Login</Link>
      </footer>
    </div>
  )
}
