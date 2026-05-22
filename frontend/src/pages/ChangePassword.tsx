import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Eye, EyeOff, KeyRound, ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, refreshUser } = useAuth() as any
  const forced = searchParams.get('forced') === 'true' || user?.must_change_password

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)

  // Strength meter
  const strength = (() => {
    if (!newPwd) return { score: 0, label: '', color: 'bg-gray-200' }
    let score = 0
    if (newPwd.length >= 6) score++
    if (newPwd.length >= 10) score++
    if (/[A-Z]/.test(newPwd) && /[a-z]/.test(newPwd)) score++
    if (/\d/.test(newPwd)) score++
    if (/[^A-Za-z0-9]/.test(newPwd)) score++
    const labels = ['', 'Lemah', 'Cukup', 'Bagus', 'Kuat', 'Sangat Kuat']
    const colors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-amber-warm', 'bg-green-500', 'bg-green-600']
    return { score, label: labels[score], color: colors[score] }
  })()

  useEffect(() => {
    if (!forced && !user) navigate('/login')
  }, [forced, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPwd.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }
    if (!forced && !oldPwd) {
      toast.error('Masukkan password lama')
      return
    }

    setLoading(true)
    try {
      await axios.put('/api/auth/password', {
        old_password: oldPwd,
        new_password: newPwd,
      })
      toast.success('Password berhasil diganti!')
      if (refreshUser) await refreshUser()

      setTimeout(() => {
        navigate(user?.role === 'superadmin' ? '/super' : '/')
      }, 800)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengganti password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background flourish */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-soft rounded-full opacity-50 blur-3xl"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-orange-200 rounded-full opacity-40 blur-3xl"></div>

      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-warm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-warm">
            <KeyRound className="w-8 h-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-extrabold text-navy mb-1">
            {forced ? 'Buat Password Baru' : 'Ganti Password'}
          </h1>
          <p className="text-navy/60 text-sm">
            {forced
              ? 'Demi keamanan akun, silakan buat password baru sebelum lanjut.'
              : 'Ganti password lama Anda dengan yang baru.'}
          </p>
        </div>

        {/* Forced reset alert */}
        {forced && (
          <div className="mb-6 bg-amber-soft border-2 border-amber-warm/40 rounded-2xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-warm flex-shrink-0 mt-0.5" strokeWidth={2.2} />
            <div className="text-xs text-navy/80 leading-relaxed">
              <div className="font-semibold text-navy mb-1">Password default sedang aktif</div>
              Admin baru saja mereset password Anda ke kode default (NIS/NIP).
              Buat password personal sekarang biar akun Anda aman.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-3xl border-2 border-warm shadow-warm-sm p-6 lg:p-8">
          {/* Old password (only if not forced) */}
          {!forced && (
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Password Lama</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPwd}
                  onChange={e => setOldPwd(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-2xl border-2 border-warm bg-cream/40 focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition placeholder:text-navy/30"
                  placeholder="Password lama Anda"
                  required={!forced}
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy/70 p-1"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New password */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="w-full pl-10 pr-12 py-3 rounded-2xl border-2 border-warm bg-cream/40 focus:ring-4 focus:ring-amber-warm/20 focus:border-amber-warm outline-none transition placeholder:text-navy/30"
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy/70 p-1"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {newPwd && (
              <div className="mt-2.5">
                <div className="flex gap-1.5 mb-1.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition ${i <= strength.score ? strength.color : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-navy/60">
                  Kekuatan: <span className="font-semibold text-navy">{strength.label || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Konfirmasi Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 rounded-2xl border-2 bg-cream/40 focus:ring-4 outline-none transition placeholder:text-navy/30 ${
                  confirmPwd && newPwd !== confirmPwd
                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                    : confirmPwd && newPwd === confirmPwd
                    ? 'border-green-300 focus:ring-green-200 focus:border-green-400'
                    : 'border-warm focus:ring-amber-warm/20 focus:border-amber-warm'
                }`}
                placeholder="Ulangi password baru"
                required
                minLength={6}
              />
              {confirmPwd && newPwd === confirmPwd && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
            </div>
            {confirmPwd && newPwd !== confirmPwd && (
              <p className="text-xs text-red-500 mt-1.5">Konfirmasi tidak cocok</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || (confirmPwd !== '' && newPwd !== confirmPwd)}
            className="w-full py-3.5 rounded-2xl gradient-warm text-white font-bold text-sm tracking-wide hover:shadow-warm transition shadow-warm-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>Simpan Password Baru</>
            )}
          </button>

          {!forced && (
            <Link
              to={user?.role === 'superadmin' ? '/super' : '/'}
              className="block text-center text-sm font-semibold text-navy/60 hover:text-amber-warm transition pt-2"
            >
              <ArrowLeft className="inline w-3.5 h-3.5 mr-1" /> Kembali ke Dashboard
            </Link>
          )}
        </form>

        <div className="mt-5 text-center text-xs text-navy/50">
          Tips: pakai kombinasi huruf besar/kecil, angka, dan simbol biar lebih aman.
        </div>
      </div>
    </div>
  )
}
