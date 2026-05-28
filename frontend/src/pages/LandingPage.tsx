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

type Tone = 'navy' | 'mint' | 'amber' | 'coral' | 'rose' | 'sky'

const toneClasses: Record<Tone, { bg: string; ring: string; iconBg: string; iconText: string; chipBg: string; chipText: string }> = {
  navy:  { bg: 'bg-navy',        ring: 'ring-navy/10',        iconBg: 'bg-navy',        iconText: 'text-white', chipBg: 'bg-navy/10',        chipText: 'text-navy' },
  mint:  { bg: 'bg-mint',        ring: 'ring-mint/10',        iconBg: 'bg-mint',        iconText: 'text-white', chipBg: 'bg-mint/15',        chipText: 'text-mint' },
  amber: { bg: 'bg-amber-warm',  ring: 'ring-amber-warm/10',  iconBg: 'bg-amber-warm',  iconText: 'text-white', chipBg: 'bg-amber-soft',     chipText: 'text-amber-warm' },
  coral: { bg: 'bg-coral',       ring: 'ring-coral/10',       iconBg: 'bg-coral',       iconText: 'text-white', chipBg: 'bg-coral/15',       chipText: 'text-coral' },
  rose:  { bg: 'bg-rose',        ring: 'ring-rose/10',        iconBg: 'bg-rose',        iconText: 'text-white', chipBg: 'bg-rose/15',        chipText: 'text-rose' },
  sky:   { bg: 'bg-sky-warm',    ring: 'ring-sky/10',         iconBg: 'bg-sky-warm',    iconText: 'text-white', chipBg: 'bg-sky-warm/15',    chipText: 'text-sky' },
}

const features: { icon: typeof Users; title: string; desc: string; tone: Tone }[] = [
  { icon: Users,          title: 'Manajemen Siswa & Guru', desc: 'Database lengkap, import Excel massal, parent access portal.',                  tone: 'navy'  },
  { icon: ClipboardCheck, title: 'Absensi Anti Fake-GPS',  desc: 'Geofencing per sekolah, deteksi mock location, foto bukti opsional.',           tone: 'mint'  },
  { icon: BookOpen,       title: 'Ujian Online + AI',      desc: 'CBT dgn timer, anti-cheat tab-switch, AI generate soal otomatis.',              tone: 'amber' },
  { icon: FileText,       title: 'Raport Otomatis',        desc: 'Generate PDF dgn kop sekolah, stempel & TTD digital. Bulk export per kelas.',   tone: 'coral' },
  { icon: Wallet,         title: 'Keuangan / SPP',          desc: 'Generate tagihan massal, riwayat pembayaran, kuitansi PDF, dashboard tunggakan.', tone: 'rose'  },
  { icon: Bell,           title: 'Notifikasi WA Otomatis',  desc: 'Fonnte / Wablas / Telegram. Trigger alfa, terlambat, tagihan jatuh tempo.',     tone: 'sky'   },
]

const stats = [
  { value: '50+',    label: 'Sekolah Aktif' },
  { value: '15rb+',  label: 'Siswa Terdaftar' },
  { value: '99.9%',  label: 'Uptime SLA' },
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
      className="absolute top-20 -left-20 w-96 h-96 bg-amber-tint rounded-full mix-blend-multiply filter blur-3xl opacity-50"
    />
    <motion.div
      animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1.1, 1, 1.1] }}
      transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute top-40 right-0 w-96 h-96 bg-coral rounded-full mix-blend-multiply filter blur-3xl opacity-25"
    />
    <motion.div
      animate={{ x: [0, 60, 0], y: [0, -80, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute bottom-20 left-1/3 w-96 h-96 bg-amber-soft rounded-full mix-blend-multiply filter blur-3xl opacity-60"
    />
  </div>
)

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 200])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="min-h-screen bg-cream text-navy overflow-x-hidden">
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
            <a href="#features" className="text-navy/70 hover:text-navy transition">Fitur</a>
            <a href="#testimoni" className="text-navy/70 hover:text-navy transition">Testimoni</a>
            <Link to="/pricing" className="text-navy/70 hover:text-navy transition">Harga</Link>
            <a href="#faq" className="text-navy/70 hover:text-navy transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-navy/70 hover:text-navy transition">Masuk</Link>
            <Link to="/pricing" className="text-sm gradient-warm text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition shadow-warm-sm">
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
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-amber-soft border border-amber-tint px-4 py-2 rounded-full text-sm text-amber-warm font-semibold mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Sistem Manajemen Sekolah Terlengkap di Indonesia</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 text-navy">
              Kelola Sekolah Anda<br />
              <span className="bg-gradient-to-r from-amber-warm via-coral to-rose bg-clip-text text-transparent">
                Tanpa Drama Excel
              </span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-xl text-navy/65 max-w-2xl mx-auto mb-10 leading-relaxed">
              Absensi, nilai, raport, SPP, notifikasi WA ke orangtua &mdash; semua dalam satu dashboard.
              Setup kurang dari 1 jam.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4">
              <Link to="/pricing" className="group gradient-warm text-white px-8 py-4 rounded-xl font-semibold text-lg transition flex items-center gap-2 shadow-warm hover:opacity-95">
                Mulai Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <a href="#features" className="bg-white border border-warm px-8 py-4 rounded-xl font-semibold text-lg text-navy hover:bg-cream-soft transition shadow-card">
                Lihat Demo Live
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-navy/60">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-mint" /> Free trial 14 hari</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-mint" /> No credit card required</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-mint" /> Setup gratis</div>
            </motion.div>
          </motion.div>

          {/* HERO MOCKUP */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="rounded-2xl overflow-hidden border border-warm shadow-card-lg bg-white">
              <div className="bg-cream-soft px-4 py-3 border-b border-warm flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-warm/70" />
                  <div className="w-3 h-3 rounded-full bg-mint/70" />
                </div>
                <div className="flex-1 text-center text-xs text-navy/50 font-medium">app.ssd.sch.id/dashboard</div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-cream-soft">
                <MockCard icon={Users}          label="Total Siswa"          value="1,247"      change="+12 minggu ini"   tone="navy" />
                <MockCard icon={ClipboardCheck} label="Hadir Hari Ini"       value="98%"        change="1,222 dari 1,247" tone="mint" />
                <MockCard icon={Wallet}         label="Pemasukan Bulan Ini"  value="Rp 387jt"   change="83% target"       tone="amber" />
                <div className="md:col-span-3 bg-white rounded-xl p-6 border border-warm shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-navy">Tren Kehadiran 7 Hari</h3>
                    <BarChart3 className="w-5 h-5 text-amber-warm" />
                  </div>
                  <div className="flex items-end gap-2 h-32">
                    {[68, 82, 91, 95, 88, 96, 98].map((v, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${v}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
                        className="flex-1 gradient-warm rounded-t"
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
      <section className="py-16 border-y border-warm bg-cream-soft">
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
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-warm to-coral bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-navy/60 text-sm mt-1 font-medium">{s.label}</div>
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
            <motion.div variants={fadeInUp} className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">
              Fitur Lengkap
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-extrabold mb-4 text-navy">
              Semua yang sekolah Anda butuhkan
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-navy/60 max-w-2xl mx-auto text-lg leading-relaxed">
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
            {features.map((f) => {
              const t = toneClasses[f.tone]
              return (
                <motion.div
                  key={f.title}
                  variants={fadeInUp}
                  whileHover={{ y: -6 }}
                  className="group relative bg-white border border-warm rounded-2xl p-8 overflow-hidden shadow-card hover:shadow-card-lg transition"
                >
                  <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center mb-5 shadow-warm-sm`}>
                    <f.icon className={`w-6 h-6 ${t.iconText}`} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-navy">{f.title}</h3>
                  <p className="text-navy/60 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="py-24 px-6 bg-cream-soft border-y border-warm">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">Cara Kerja</div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-navy">3 langkah, sekolah Anda online</h2>
            <p className="text-navy/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Dari sign-up sampai siswa pertama absen, kurang dari 1 jam.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {([
              { step: '01', title: 'Daftar & Setup',     desc: 'Isi data sekolah, upload logo & stempel. Tim kami bantu import siswa dari Excel.', icon: School, tone: 'amber' as Tone },
              { step: '02', title: 'Onboarding Admin',   desc: 'Training 1 jam via Zoom buat admin & guru. Buku panduan PDF disertakan.',          icon: Heart,  tone: 'coral' as Tone },
              { step: '03', title: 'Live Use',           desc: 'Siswa scan QR absen, guru input nilai, ortu dapet notif WA otomatis.',             icon: Zap,    tone: 'mint'  as Tone },
            ]).map((s, i) => {
              const t = toneClasses[s.tone]
              return (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-white border border-warm rounded-2xl p-8 relative shadow-card overflow-hidden"
                >
                  <div className="text-7xl font-extrabold text-amber-soft absolute top-2 right-6 leading-none select-none">
                    {s.step}
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${t.iconBg} flex items-center justify-center mb-5 shadow-warm-sm relative`}>
                    <s.icon className="w-6 h-6 text-white" strokeWidth={2.2} />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-navy relative">{s.title}</h3>
                  <p className="text-navy/60 text-sm leading-relaxed relative">{s.desc}</p>
                </motion.div>
              )
            })}
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
            <div className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">Testimoni</div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-navy">Dipercaya kepala sekolah</h2>
            <div className="flex items-center justify-center gap-1 mt-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-amber-warm text-amber-warm" />
              ))}
              <span className="ml-2 text-navy/70 font-semibold">4.9/5 dari 50+ sekolah</span>
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
                className="bg-white border border-warm rounded-2xl p-8 shadow-card hover:shadow-card-lg transition"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-warm text-amber-warm" />
                  ))}
                </div>
                <p className="text-navy/80 leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-warm">
                  <div className="text-3xl">{t.avatar}</div>
                  <div>
                    <div className="font-semibold text-navy">{t.name}</div>
                    <div className="text-xs text-navy/60">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MULTI-DEVICE */}
      <section className="py-24 px-6 bg-cream-soft border-y border-warm">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-sm text-amber-warm font-bold uppercase tracking-wider mb-3">Multi-device</div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-navy leading-tight">
              Akses dari HP, tablet, atau PC
            </h2>
            <p className="text-navy/65 text-lg mb-8 leading-relaxed">
              Web app responsif &mdash; tidak perlu install. Guru bisa absen pakai HP di kelas,
              admin pakai laptop, ortu cek nilai dari smartphone.
            </p>
            <div className="space-y-4">
              {([
                { icon: Smartphone, title: 'Mobile-first', desc: 'Touch-friendly UI, offline absensi optional.', tone: 'amber' as Tone },
                { icon: Globe,      title: 'PWA Ready',    desc: 'Install jadi app di home screen tanpa Play Store.', tone: 'mint'  as Tone },
                { icon: Shield,     title: 'Aman',          desc: 'JWT auth, rate-limit, anti fake-GPS.',          tone: 'navy'  as Tone },
              ]).map((item) => {
                const t = toneClasses[item.tone]
                return (
                  <div key={item.title} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-lg ${t.chipBg} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-5 h-5 ${t.chipText}`} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-navy">{item.title}</h4>
                      <p className="text-sm text-navy/60">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-square gradient-cream rounded-3xl border border-warm p-12 flex items-center justify-center shadow-card">
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
            <div className="text-sm text-amber-warm font-bold tracking-wider uppercase mb-3">FAQ</div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-navy">Pertanyaan Umum</h2>
            <p className="text-navy/60">Belum nemu jawabannya? Chat WA admin di footer.</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white border border-warm rounded-xl overflow-hidden shadow-card"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-cream-soft transition list-none">
                  <span className="font-semibold text-navy pr-4">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-amber-warm flex-shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-navy/65 leading-relaxed">{faq.a}</div>
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
          className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl gradient-navy p-12 md:p-16 text-center text-white shadow-card-lg"
        >
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-amber-warm rounded-full mix-blend-overlay filter blur-3xl opacity-40" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-coral rounded-full mix-blend-overlay filter blur-3xl opacity-30" />
          <div className="relative">
            <div className="w-14 h-14 mx-auto mb-6 rounded-2xl gradient-warm flex items-center justify-center shadow-warm">
              <Sparkles className="w-7 h-7 text-white" strokeWidth={2.2} />
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              Siap modernisasi sekolah Anda?
            </h2>
            <p className="text-xl text-white/75 mb-8 max-w-2xl mx-auto leading-relaxed">
              Free trial 14 hari, setup gratis, tidak perlu kartu kredit.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/pricing" className="gradient-warm text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-95 transition shadow-warm">
                Mulai Trial Gratis
              </Link>
              <Link to="/login" className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-8 py-4 rounded-xl font-bold text-lg transition backdrop-blur">
                Coba Demo Login
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-warm py-12 px-6 bg-cream-soft">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg mb-3 text-navy">
              <div className="w-8 h-8 rounded-lg gradient-warm flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <div>SSD</div>
                <div className="text-[10px] text-amber-warm font-semibold -mt-0.5">Smart System Digital</div>
              </div>
            </div>
            <p className="text-navy/60">Sistem manajemen sekolah modern untuk Indonesia.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-navy">Produk</h4>
            <ul className="space-y-2 text-navy/60">
              <li><a href="#features" className="hover:text-amber-warm transition">Fitur</a></li>
              <li><Link to="/pricing" className="hover:text-amber-warm transition">Harga</Link></li>
              <li><Link to="/login" className="hover:text-amber-warm transition">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-navy">Kontak</h4>
            <ul className="space-y-2 text-navy/60">
              <li>WA: 0812-xxxx-xxxx</li>
              <li>Email: hello@ssd.sch.id</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-navy">Legal</h4>
            <ul className="space-y-2 text-navy/60">
              <li><a href="#" className="hover:text-amber-warm transition">Privacy</a></li>
              <li><a href="#" className="hover:text-amber-warm transition">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-warm text-center text-navy/50 text-sm">
          &copy; 2026 SSD &mdash; Smart System Digital. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

type MockCardProps = {
  icon: typeof Users
  label: string
  value: string
  change: string
  tone: Tone
}

function MockCard({ icon: Icon, label, value, change, tone }: MockCardProps) {
  const t = toneClasses[tone]
  return (
    <div className="bg-white border border-warm rounded-xl p-5 shadow-card">
      <div className={`w-9 h-9 rounded-lg ${t.iconBg} flex items-center justify-center mb-2 shadow-warm-sm`}>
        <Icon className="w-4 h-4 text-white" strokeWidth={2.3} />
      </div>
      <div className="text-xs text-navy/55 font-medium">{label}</div>
      <div className="text-2xl font-extrabold text-navy mt-1">{value}</div>
      <div className="text-xs text-navy/45 mt-1">{change}</div>
    </div>
  )
}
