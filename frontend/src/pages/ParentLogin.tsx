import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { GraduationCap, Key } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Orang Tua</h1>
          <p className="text-gray-500 mt-1">Masuk dengan NIS anak dan kode akses</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIS Anak</label>
            <input type="text" value={nis} onChange={e => setNis(e.target.value)}
              placeholder="Masukkan NIS anak"
              className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kode Akses</label>
            <div className="relative">
              <Key className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)}
                placeholder="6 digit kode"
                maxLength={6}
                className="w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none tracking-widest text-center text-lg font-mono" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? 'Masuk...' : 'Masuk'}
          </button>

          <div className="text-center">
            <a href="/login" className="text-sm text-indigo-600 hover:underline">
              Login sebagai Guru/Admin
            </a>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Kode akses didapat dari sekolah. Hubungi admin jika belum punya.
        </p>
      </div>
    </div>
  )
}
