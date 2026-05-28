import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useRef } from 'react'
import {
  GraduationCap, Users, BookOpen, ClipboardCheck, Wallet, Bell,
  FileText, Shield, Zap, Heart, ArrowRight, Check, Sparkles,
  School, Star, ChevronDown, Globe, Smartphone, BarChart3,
} from 'lucide-react'

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const features = [
  { icon: Users, title: 'Manajemen Siswa & Guru', desc: 'Database lengkap, import Excel massal, parent access portal.', color: 'from-blue-500 to-cyan-500' },
  { icon: ClipboardCheck, title: 'Absensi Anti Fake-GPS', desc: 'Geofencing per sekolah, deteksi mock location, foto bukti opsional.', color: 'from-emerald-500 to-teal-500' },
  { icon: BookOpen, title: 'Ujian Online + AI', desc: 'CBT dgn timer, anti-cheat tab-switch, AI generate soal otomatis.', color: 'from-violet-500 to-purple-500' },
  { icon: FileText, title: 'Raport Otomatis', desc: 'Generate PDF dgn kop sekolah, stempel & TTD digital. Bulk export per kelas.', color: 'from-orange-500 to-red-500' },
  { icon: Wallet, title: 'Keuangan / SPP', desc: 'Generate tagihan massal, riwayat pembayaran, kuitansi PDF, dashboard tunggakan.', color: 'from-pink-500 to-rose-500' },
  { icon: Bell, title: 'Notifikasi WA Otomatis', desc: 'Fonnte / Wablas / Telegram. Trigger alfa, terlambat, tagihan jatuh tempo.', color: 'from-amber-500 to-yellow-500' },
]

const stats = [
  { value: '50+', label: 'Sekolah Aktif' },
  { value: '15rb+', label: 'Siswa Terdaftar' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '<200ms', label: 'API Response' },
]

const testimonials = [
  {
    name: 'H. Abdul Karim, S.Pd',
    role: 'Kepala SMA Al-Hidayah',
    text: 'Sebelumnya rekap absen pake Excel manual, sekarang real-time. Notif WA ke ortu udah otomatis kalau anaknya alfa.',
    avatar: '👨‍🏫',
  },
  {
    name: 'Ustz. Fatimah Zahra',
    role: 'Bendahara Pesantren An-Nur',
    text: 'Tagihan SPP yang dulu makan 3 hari sebulan sekarang 30 menit aja. Kuitansi langsung PDF rapi, ortu dapet via WA.',
    avatar: '👩‍💼',
  },
  {
    name: 'Pak Budi Santoso',
    role: 'Wakasek Kurikulum SMP',
    text: 'AI generate soal dari materi PDF beneran ngehemat waktu guru. Raport tinggal klik, ada stempel + TTD digital.',
    avatar: '👨‍💼',
  },
]

const faqs = [
  {
    q: 'Berapa lama setup sampai bisa dipakai?',
    a: 'Kurang dari 1 jam. Tim kami bantu import data siswa dari Excel, setup struktur kelas, dan training admin via Zoom. Hari ke-2 sudah siap absen.',
  },
  {
    q: 'Apakah data sekolah aman?',
    a: 'Database terisolasi per sekolah (multi-tenant), backup otomatis harian, SSL/HTTPS, dan kompatibel dgn UU PDP. Anda full ownership data Anda.',
  },
  {
    q: 'Apakah bisa coba dulu sebelum bayar?',
    a: 'Bisa. Login demo: admin@demo.lms.id / demo123. Akun demo punya 90 siswa, 3 kelas, dan 270 tagihan dummy buat eksplor semua fitur.',
  },
  {
    q: 'Notifikasi WA pakai nomor kami atau bot?',
    a: 'Anda pakai akun Fonnte / Wablas / Telegram Bot sendiri (BYOK). SSD cuma kirim event ke API Anda, jadi nomor tetap kontrol Anda.',
  },
  {
    q: 'Kalau langganan saya stop apa terjadi?',
    a: 'Data tetap kami simpan 30 hari. Anda bisa export semua data ke Excel/CSV kapan aja sebelum cancel. No vendor lock-in.',
  },
]

const HeroBlob = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-20 -left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
    />
    <motion.div
      animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1.1, 1, 1.1] }}
      transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-40 right-0 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
    />
    <motion.div
      animate={{ x: [0, 60, 0], y: [0, -80, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute bottom-20 left-1/3 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
    />
  </div>
)

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 200])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-9 h-9 rounded-xl gradient-warm flex items-center justify-center shadow-warm-sm">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold">SSD</div>
              <div className="text-[10px] text-amber-200 -mt-0.5">Smart System Digital</div>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-slate-300 hover:text-white transition">Fitur</a>
            <a href="#testimoni" className="text-slate-300 hover:text-white transition">Testimoni</a>
            <Link to="/pricing" className="text-slate-300 hover:text-white transition">Harga</Link>
            <a href="#faq" className="text-slate-300 hover:text-white transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition">Masuk</Link>
            <Link to="/pricing" className="text-sm bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100 transition">
              Mulai Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative pt-32 pb-24 px-6 min-h-screen flex items-center">
        <HeroBlob />
        <motion.div style={{ y, opacity }} className="relative max-w-7xl mx-auto w-full">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm text-slate-300 mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sistem Manajemen Sekolah Terlengkap di Indonesia</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Kelola Sekolah Anda<br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Tanpa Drama Excel
              </span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              Absensi, nilai, raport, SPP, notifikasi WA ke orangtua &mdash; semua dalam satu dashboard.
              Setup kurang dari 1 jam.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
              <Link to="/pricing" className="group bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-8 py-4 rounded-xl font-semibold text-lg transition flex items-center gap-2 shadow-2xl shadow-purple-500/30">
                Mulai Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <a href="#features" className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-4 rounded-xl font-semibold text-lg transition">
                Lihat Demo Live
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Free trial 14 hari</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> No credit card required</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Setup gratis</div>
            </motion.div>
          </motion.div>

          {/* HERO MOCKUP */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-purple-500/20 bg-gradient-to-br from-slate-900 to-slate-800">
              <div className="bg-slate-900/80 px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 text-center text-xs text-slate-400">app.smart-lms.id/dashboard</div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <MockCard icon={Users} label="Total Siswa" value="1,247" change="+12 minggu ini" tone="indigo" />
                <MockCard icon={ClipboardCheck} label="Hadir Hari Ini" value="98%" change="1,222 dari 1,247" tone="emerald" />
                <MockCard icon={Wallet} label="Pemasukan Bulan Ini" value="Rp 387jt" change="83% target" tone="amber" />
                <div className="md:col-span-3 bg-slate-800/50 rounded-xl p-6 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Tren Kehadiran 7 Hari</h3>
                    <BarChart3 className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex items-end gap-2 h-32">
                    {[68, 82, 91, 95, 88, 96, 98].map((v, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${v}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
                        className="flex-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="py-16 border-y border-white/10 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.div variants={fadeInUp} className="text-sm text-indigo-400 font-semibold tracking-wider uppercase mb-3">
              Fitur Lengkap
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
              Semua yang sekolah Anda butuhkan
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-slate-400 max-w-2xl mx-auto text-lg">
              Tidak perlu beli 5 software berbeda. SSD gabungkan absensi, akademik, keuangan, dan komunikasi.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeInUp}
                whileHover={{ y: -8 }}
                className="group relative bg-white/5 border border-white/10 rounded-2xl p-8 overflow-hidden hover:border-white/20 transition"
              >
                <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${f.color} opacity-20 blur-3xl group-hover:opacity-40 transition`} />
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="relative font-bold text-xl mb-2">{f.title}</h3>
                <p className="relative text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">3 langkah, sekolah Anda online</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Dari sign-up sampai siswa pertama absen, kurang dari 1 jam.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {[
              { step: '01', title: 'Daftar & Setup', desc: 'Isi data sekolah, upload logo & stempel. Tim kami bantu import siswa dari Excel.', icon: School },
              { step: '02', title: 'Onboarding Admin', desc: 'Training 1 jam via Zoom buat admin & guru. Buku panduan PDF disertakan.', icon: Heart },
              { step: '03', title: 'Live Use', desc: 'Siswa scan QR absen, guru input nilai, ortu dapet notif WA otomatis.', icon: Zap },
            ].map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 relative"
              >
                <div className="text-7xl font-bold bg-gradient-to-br from-indigo-500/30 to-purple-500/30 bg-clip-text text-transparent absolute top-4 right-6">
                  {step.step}
                </div>
                <step.icon className="w-10 h-10 text-indigo-400 mb-4 relative" />
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimoni" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-sm text-indigo-400 font-semibold tracking-wider uppercase mb-3">Testimoni</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Dipercaya kepala sekolah</h2>
            <div className="flex items-center justify-center gap-1 mt-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-2 text-slate-300">4.9/5 dari 50+ sekolah</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <div className="text-3xl">{t.avatar}</div>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MULTI-DEVICE */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-950 to-indigo-950/30">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-sm text-indigo-400 font-semibold uppercase mb-3">Multi-device</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Akses dari HP, tablet, atau PC
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Web app responsif &mdash; tidak perlu install. Guru bisa absen pakai HP di kelas,
              admin pakai laptop, ortu cek nilai dari smartphone.
            </p>
            <div className="space-y-4">
              {[
                { icon: Smartphone, title: 'Mobile-first', desc: 'Touch-friendly UI, offline absensi optional.' },
                { icon: Globe, title: 'PWA Ready', desc: 'Install jadi app di home screen tanpa Play Store.' },
                { icon: Shield, title: 'Aman', desc: 'JWT auth, rate-limit, anti fake-GPS.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-square bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl border border-white/10 p-12 flex items-center justify-center">
              <div className="text-9xl">📱💻</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Pertanyaan Umum</h2>
            <p className="text-slate-400">Belum nemu jawabannya? Chat WA admin di footer.</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
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

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-12 md:p-16 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent)]" />
          <div className="relative">
            <Sparkles className="w-12 h-12 mx-auto mb-6 text-white/80" />
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Siap modernisasi sekolah Anda?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Free trial 14 hari, setup gratis, tidak perlu kartu kredit.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/pricing" className="bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-100 transition">
                Mulai Trial Gratis
              </Link>
              <Link to="/login" className="bg-white/10 hover:bg-white/20 border border-white/20 px-8 py-4 rounded-xl font-bold text-lg transition">
                Coba Demo Login
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <div className="w-8 h-8 rounded-lg gradient-warm flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <div>SSD</div>
                <div className="text-[10px] text-amber-200 font-semibold -mt-0.5">Smart System Digital</div>
              </div>
            </div>
            <p className="text-slate-400">Sistem manajemen sekolah modern untuk Indonesia.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Produk</h4>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#features" className="hover:text-white">Fitur</a></li>
              <li><Link to="/pricing" className="hover:text-white">Harga</Link></li>
              <li><Link to="/login" className="hover:text-white">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Kontak</h4>
            <ul className="space-y-2 text-slate-400">
              <li>WA: 0812-xxxx-xxxx</li>
              <li>Email: hello@smart-lms.id</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-white">Privacy</a></li>
              <li><a href="#" className="hover:text-white">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/10 text-center text-slate-500 text-sm">
          &copy; 2026 SSD &mdash; Smart System Digital. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

function MockCard({ icon: Icon, label, value, change, tone }: any) {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
  }
  return (
    <div className={`bg-gradient-to-br ${tones[tone]} border rounded-xl p-5`}>
      <Icon className="w-5 h-5 mb-2" />
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{change}</div>
    </div>
  )
}
