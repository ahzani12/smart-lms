import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Heart, Key, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react'

export default function ParentLogin() {
  const [nis, setNis] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nis || !accessCode) {
      toast.error('NIS dan kode akses wajib diisi')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post('/api/auth/parent-login', { nis, access_code: accessCode })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      toast.success(`Selamat datang, ${res.data.user.name || 'Orang Tua'} ${res.data.user.student_name}`)
      navigate('/parent')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login gagal')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left hero (desktop) */}
      <div className="hidden lg:flex w-1/2 bg-navy text-white p-12 flex-col relative overflow-hidden">
        <div className="grid-pattern absolute inset-0 opacity-25"></div>

        <div className="relative flex items-center gap-3 mb-auto">
          <div className="w-12 h-12 gradient-warm rounded-2xl flex items-center justify-center shadow-warm">
            <Heart className="w-6 h-6 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <div className="font-extrabold text-xl leading-tight">Portal Orang Tua</div>
            <div className="text-xs text-amber-200">SSD · Smart System Digital</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-warm/15 border border-amber-warm/30 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-warm" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-amber-200 tracking-wide">PANTAU ANAK ANDA</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Tetap dekat dengan perkembangan anak, kapan saja.
          </h1>
          <p className="text-white/70 leading-relaxed">
            Lihat absensi, nilai ujian, raport, dan komunikasi langsung dengan wali kelas
            dalam satu portal sederhana untuk orang tua.
          </p>
        </div>

        <div className="relative mt-12 flex items-center gap-3 text-xs text-white/60">
          <ShieldCheck className="w-4 h-4 text-amber-warm" />
          <span>Data anak Anda terenkripsi dan hanya dapat diakses dengan kode akses sekolah.</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        <div className="lg:hidden absolute -top-32 -right-32 w-96 h-96 bg-amber-soft rounded-full opacity-50 blur-3xl"></div>
        <div className="lg:hidden absolute -bottom-32 -left-32 w-96 h-96 bg-orange-200 rounded-full opacity-40 blur-3xl"></div>

        <div className="w-full max-w-md relative">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 gradient-warm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-warm">
              <Heart className="w-9 h-9 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-extrabold text-navy">Portal Orang Tua</h1>
            <p className="text-navy/60 text-sm">SSD · Smart System Digital</p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-navy mb-2">Masuk Portal Anak 💛</h2>
            <p className="text-navy/60">Gunakan NIS anak dan kode akses dari sekolah.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">NIS Anak</label>
              <input
                type="text"
                value={nis}
                onChange={e => setNis(e.target.value)}
                placeholder="Masukkan NIS anak"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-warm bg-white focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition placeholder:text-navy/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Kode Akses</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-warm" strokeWidth={2.4} />
                <input
                  type="text"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                  placeholder="6 digit kode"
                  maxLength={6}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-warm bg-white focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition tracking-[0.4em] text-center text-lg font-mono font-bold text-navy placeholder:text-navy/30 placeholder:tracking-normal placeholder:font-sans"
                />
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
                  Masuk Portal <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>

            <div className="text-center">
              <a href="/login" className="text-sm font-semibold text-navy/70 hover:text-amber-warm transition">
                Login sebagai Guru/Admin →
              </a>
            </div>
          </form>

          <div className="mt-6 bg-amber-soft/50 border border-warm rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-warm/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Key className="w-4 h-4 text-amber-warm" strokeWidth={2.4} />
            </div>
            <div className="text-xs text-navy/70 leading-relaxed">
              Kode akses didapat dari sekolah. Hubungi admin atau wali kelas jika belum punya.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
