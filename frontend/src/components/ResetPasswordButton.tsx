import { KeyRound, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

interface Props {
  userId: number
  userName: string
  onDone?: () => void
}

/**
 * ResetPasswordButton — tombol kecil yang admin pakai untuk reset password user
 * ke kode default (NIS/NIP). User akan dipaksa ganti password saat login berikutnya.
 */
export default function ResetPasswordButton({ userId, userName, onDone }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ password: string; source: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`/api/users/${userId}/reset-password`, {})
      setResult({ password: res.data.new_password, source: res.data.source })
      toast.success('Password berhasil direset')
      onDone?.()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal reset password')
      setShowModal(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const close = () => {
    setShowModal(false)
    setResult(null)
    setCopied(false)
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-2 rounded-xl hover:bg-amber-soft text-amber-warm transition"
        title="Reset Password"
      >
        <KeyRound className="w-4 h-4" strokeWidth={2.4} />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-3xl border-2 border-warm shadow-warm w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Confirm step */}
            {!result && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-amber-soft rounded-2xl flex items-center justify-center">
                    <KeyRound className="w-6 h-6 text-amber-warm" strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-navy">Reset Password?</h3>
                    <p className="text-xs text-navy/60">Untuk: {userName}</p>
                  </div>
                </div>

                <div className="bg-amber-soft/50 border border-warm rounded-2xl p-4 mb-4 text-sm text-navy/80 leading-relaxed">
                  Password user akan direset ke kode default (<b>NIS/NIP</b> mereka).
                  Saat login berikutnya, mereka <b>wajib ganti password</b> sebelum bisa
                  pakai aplikasi.
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={close}
                    disabled={loading}
                    className="flex-1 px-4 py-3 rounded-2xl border-2 border-warm text-navy font-semibold hover:bg-cream-soft transition disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={loading}
                    className="flex-1 px-4 py-3 rounded-2xl gradient-warm text-white font-semibold hover:shadow-warm transition shadow-warm-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Reset...
                      </>
                    ) : (
                      <>Ya, Reset</>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Result step */}
            {result && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-navy">Password Direset!</h3>
                    <p className="text-xs text-navy/60">{userName}</p>
                  </div>
                </div>

                <div className="bg-cream-soft border-2 border-warm rounded-2xl p-4 mb-4">
                  <div className="text-[10px] font-extrabold text-navy/60 uppercase tracking-wider mb-1.5">
                    Password Baru ({result.source})
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-2xl font-extrabold text-amber-warm tracking-widest">
                      {result.password}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-2.5 rounded-xl bg-white border border-warm hover:bg-amber-soft transition"
                      title="Salin"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" strokeWidth={2.4} />
                      ) : (
                        <Copy className="w-4 h-4 text-navy/60" strokeWidth={2.4} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-navy/70 leading-relaxed mb-4 bg-amber-soft/30 border border-warm/40 rounded-xl p-3">
                  💡 Beri tahu user. Mereka harus ganti password saat login
                  pertama (otomatis muncul halamannya).
                </div>

                <button
                  onClick={close}
                  className="w-full px-4 py-3 rounded-2xl gradient-warm text-white font-semibold hover:shadow-warm transition shadow-warm-sm"
                >
                  Selesai
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
