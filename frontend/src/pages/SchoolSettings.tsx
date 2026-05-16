import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { School, Upload, Save } from 'lucide-react'

export default function SchoolSettings() {
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    npsn: '',
    level: '',
    header_text: '',
    header_color: '#1e40af',
    header_logo: '',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get('/api/school').then(r => {
      setForm(r.data)
      if (r.data.header_logo) setLogoPreview(r.data.header_logo)
    })
  }, [])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleUploadLogo = async () => {
    if (!logoFile) {
      toast.error('Pilih file logo dulu')
      return
    }
    const fd = new FormData()
    fd.append('logo', logoFile)
    try {
      const res = await axios.post('/api/school/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setForm({ ...form, header_logo: res.data.path })
      toast.success('Logo berhasil diupload')
    } catch {
      toast.error('Gagal upload logo')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.put('/api/school', form)
      toast.success('Data sekolah disimpan')
    } catch {
      toast.error('Gagal menyimpan')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <School className="w-6 h-6 text-indigo-600" />
          Pengaturan Sekolah
        </h1>
        <p className="text-gray-500">Atur identitas sekolah yang tampil di kop raport</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo Section */}
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Logo Sekolah</h2>
          <p className="text-sm text-gray-500">Logo akan tampil di kop surat raport</p>

          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-gray-400 text-sm text-center px-2">Belum ada logo</span>
              )}
            </div>

            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm">
              <Upload className="w-4 h-4" />
              Pilih File
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>

            {logoFile && (
              <button onClick={handleUploadLogo}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm">
                Upload Logo
              </button>
            )}
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Identitas Sekolah</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="SMA Negeri 1 Contoh"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NPSN</label>
              <input type="text" value={form.npsn} onChange={e => setForm({ ...form, npsn: e.target.value })}
                placeholder="12345678"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Jl. Pendidikan No. 1, Jakarta"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="021-1234567"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="text" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="info@sekolah.sch.id"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="www.sekolah.sch.id"
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jenjang</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Pilih...</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
                <option value="MA">MA</option>
                <option value="MTs">MTs</option>
                <option value="MI">MI</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Header Kop Surat (instansi di atas nama sekolah)</label>
            <textarea value={form.header_text} onChange={e => setForm({ ...form, header_text: e.target.value })}
              rows={3} placeholder="REPUBLIK INDONESIA&#10;PEMERINTAH DAERAH&#10;DINAS PENDIDIKAN"
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            <p className="text-xs text-gray-400 mt-1">Pisahkan baris dengan Enter. Akan tampil di atas nama sekolah pada kop raport.</p>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Preview Kop Raport</h2>
        <div className="border rounded-xl p-6 max-w-2xl mx-auto" style={{ fontFamily: "'Times New Roman', serif" }}>
          <div className="flex items-center border-b-4 border-black pb-3">
            <div className="w-16 h-16 border border-gray-300 flex items-center justify-center mr-4 flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-[8px] text-gray-400">LOGO</span>
              )}
            </div>
            <div className="text-center flex-1">
              <div className="text-[10px] tracking-wide whitespace-pre-line">{form.header_text || 'PEMERINTAH DAERAH\nDINAS PENDIDIKAN'}</div>
              <div className="text-base font-bold tracking-wider uppercase">{form.name || 'NAMA SEKOLAH'}</div>
              <div className="text-[9px]">{form.address || 'Alamat Sekolah'}</div>
              <div className="text-[9px]">
                {form.phone && `Telp. ${form.phone}`} {form.email && `| ${form.email}`} {form.website && `| ${form.website}`}
              </div>
            </div>
          </div>
          <div className="border-t border-black mt-0.5"></div>
        </div>
      </div>
    </div>
  )
}
