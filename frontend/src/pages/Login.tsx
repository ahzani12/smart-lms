import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  GraduationCap, Eye, EyeOff, Sparkles, ShieldCheck, Users,
  TrendingUp, BookOpen, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success('Selamat datang!')
      navigate(user.role === 'superadmin' ? '/super' : '/')
    } catch {
      toast.error('Login gagal. Periksa kembali ID/NIP/Email dan password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* ===== Left side — Hero (desktop only) ===== */}
      <div className="hidden lg:flex w-1/2 bg-navy text-white p-12 flex-col relative overflow-hidden">
        <div className="grid-pattern absolute inset-0 opacity-25"></div>

        {/* Logo */}
        <div className="relative flex items-center gap-3 mb-auto">
          <div className="w-12 h-12 gradient-warm rounded-2xl flex items-center justify-center shadow-warm">
            <GraduationCap className="w-7 h-7 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-extrabold text-xl leading-tight">SSD</div>
            <div className="text-xs text-amber-200">Sistem Sekolah Digital</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-warm/15 border border-amber-warm/30 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-warm" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-amber-200 tracking-wide">PLATFORM SEKOLAH MODERN</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Kelola sekolah lebih cerdas, dari satu dashboard hangat.
          </h1>
          <p className="text-white/70 leading-relaxed">
            Absensi, ujian online, bank soal AI, hingga raport otomatis — semua dirancang
            agar guru dan admin fokus mengajar, bukan sibuk admin.
          </p>
        </div>

        {/* Stats strip */}
        <div className="relative mt-12 grid grid-cols-3 gap-4">
          <div className="border-l-2 border-amber-warm pl-4">
            <div className="flex items-center gap-1.5 text-xs text-amber-200 font-semibold mb-1">
              <Users className="w-3.5 h-3.5" /> SISWA AKTIF
            </div>
            <div className="text-2xl font-extrabold">1,247</div>
          </div>
          <div className="border-l-2 border-amber-warm/50 pl-4">
            <div className="flex items-center gap-1.5 text-xs text-amber-200 font-semibold mb-1">
              <BookOpen className="w-3.5 h-3.5" /> BANK SOAL
            </div>
            <div className="text-2xl font-extrabold">2,389</div>
          </div>
          <div className="border-l-2 border-amber-warm/50 pl-4">
            <div className="flex items-center gap-1.5 text-xs text-amber-200 font-semibold mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> KEHADIRAN
            </div>
            <div className="text-2xl font-extrabold">94.2%</div>
          </div>
        </div>
      </div>

      {/* ===== Right side — Form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        {/* Mobile background flourish */}
        <div className="lg:hidden absolute -top-32 -right-32 w-96 h-96 bg-amber-soft rounded-full opacity-50 blur-3xl"></div>
        <div className="lg:hidden absolute -bottom-32 -left-32 w-96 h-96 bg-orange-200 rounded-full opacity-40 blur-3xl"></div>

        <div className="w-full max-w-md relative">
          {/* Mobile-only logo header */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 gradient-warm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-warm">
              <GraduationCap className="w-9 h-9 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-extrabold text-navy">SSD</h1>
            <p className="text-navy/60 text-sm">Sistem Sekolah Digital</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-navy mb-2">Selamat datang 👋</h2>
            <p className="text-navy/60">Masuk untuk lanjut mengelola sekolah Anda hari ini.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Email / NIP / ID Siswa
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-warm bg-white focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition placeholder:text-navy/30"
                placeholder="Email, NIP Guru, atau ID Siswa"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-navy">Password</label>
                <a href="#" className="text-xs text-amber-warm font-semibold hover:underline">
                  Lupa password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl border-2 border-warm bg-white focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition placeholder:text-navy/30"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy/70 p-2"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-2xl gradient-warm text-white font-bold text-sm tracking-wide hover:shadow-warm transition shadow-warm-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Masuk...
                </>
              ) : (
                <>
                  Masuk <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Helper card */}
          <div className="mt-6 bg-amber-soft/50 border border-warm rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-warm/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-warm" strokeWidth={2.4} />
            </div>
            <div className="text-xs text-navy/70 leading-relaxed">
              <span className="font-semibold text-navy">Tips login:</span> Admin pakai email,
              Guru pakai NIP, Siswa pakai ID 6 digit. Hubungi admin sekolah jika lupa.
            </div>
          </div>

          {/* Parent login link */}
          <div className="mt-6 text-center">
            <a
              href="/parent-login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-navy/70 hover:text-amber-warm transition"
            >
              <span>Orang tua siswa? Masuk lewat sini</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
