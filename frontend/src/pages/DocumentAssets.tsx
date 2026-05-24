import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Stamp, FileSignature, Image as ImageIcon, Upload, Loader2, Save } from 'lucide-react'

type Asset = {
  logo_url: string
  stempel_url: string
  kepala_ttd: string
  kepala_name: string
  kepala_nip: string
  bendahara_ttd: string
  bendahara_name: string
  bendahara_nip: string
  yayasan_name: string
  kabupaten: string
  kode_pos: string
}

const empty: Asset = {
  logo_url: '', stempel_url: '', kepala_ttd: '', kepala_name: '', kepala_nip: '',
  bendahara_ttd: '', bendahara_name: '', bendahara_nip: '',
  yayasan_name: '', kabupaten: '', kode_pos: '',
}

export default function DocumentAssets() {
  const [data, setData] = useState<Asset>(empty)
  const [school, setSchool] = useState<any>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = () => axios.get('/api/school/doc-assets').then(r => setData({ ...empty, ...r.data }))

  useEffect(() => {
    reload()
    axios.get('/api/school').then(r => setSchool(r.data))
  }, [])

  const upload = async (endpoint: string, field: string, file: File, busyKey: string) => {
    setBusy(busyKey)
    const fd = new FormData()
    fd.append(field, file)
    try {
      await axios.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Upload berhasil — background otomatis dihapus')
      await reload()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload gagal')
    }
    setBusy(null)
  }

  const saveText = async () => {
    setSaving(true)
    try {
      await axios.put('/api/school', {
        ...school,
        yayasan_name: data.yayasan_name,
        kabupaten: data.kabupaten,
        kode_pos: data.kode_pos,
        kepala_name: data.kepala_name,
        kepala_nip: data.kepala_nip,
        bendahara_name: data.bendahara_name,
        bendahara_nip: data.bendahara_nip,
      })
      toast.success('Data tersimpan')
    } catch {
      toast.error('Gagal menyimpan')
    }
    setSaving(false)
  }

  const UploadCard = ({
    title, hint, current, busyKey, endpoint, field, icon: Icon,
  }: {
    title: string; hint: string; current?: string; busyKey: string;
    endpoint: string; field: string; icon: any;
  }) => (
    <div className="bg-white rounded-2xl border border-warm/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-amber-warm" />
        <h3 className="font-extrabold text-navy">{title}</h3>
      </div>
      <p className="text-xs text-navy/60">{hint}</p>
      <div className="aspect-square w-full max-w-[160px] mx-auto border-2 border-dashed border-warm/60 rounded-xl bg-cream-soft flex items-center justify-center overflow-hidden">
        {current ? (
          <img src={current} alt={title} className="w-full h-full object-contain p-2"
               style={{ background: 'repeating-conic-gradient(#f4ead8 0% 25%, transparent 0% 50%) 50% / 16px 16px' }} />
        ) : (
          <span className="text-navy/40 text-xs">Belum ada</span>
        )}
      </div>
      <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 bg-amber-soft/50 text-navy rounded-xl hover:bg-warm text-sm font-bold">
        {busy === busyKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {busy === busyKey ? 'Memproses...' : 'Pilih File'}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          disabled={busy !== null}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) upload(endpoint, field, f, busyKey)
          }}
        />
      </label>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 lg:p-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy flex items-center gap-2">
          <Stamp className="w-7 h-7 text-amber-warm" />
          Kop, Stempel & Tandatangan
        </h1>
        <p className="text-navy/60 text-sm mt-1">
          Upload logo sekolah, stempel, dan tandatangan kepsek/bendahara.
          Background putih otomatis dihapus, jadi siap pakai untuk kuitansi & raport.
        </p>
      </div>

      <div className="bg-amber-soft/30 border border-amber-warm/30 rounded-2xl p-4 text-sm">
        <p className="font-bold text-navy">💡 Tips scan TTD/stempel</p>
        <ul className="mt-1 text-navy/70 list-disc list-inside space-y-0.5 text-xs">
          <li>Tinta hitam/biru pekat di kertas putih bersih</li>
          <li>Scan/foto resolusi tinggi (≥1000px), pencahayaan rata</li>
          <li>Format PNG/JPG, max 5MB</li>
          <li>Background putih otomatis jadi transparan setelah upload</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <UploadCard
          title="Logo Sekolah"
          hint="Tampil di kop kuitansi & raport"
          current={data.logo_url}
          busyKey="logo"
          endpoint="/api/school/doc-logo"
          field="logo"
          icon={ImageIcon}
        />
        <UploadCard
          title="Stempel"
          hint="Stempel resmi sekolah"
          current={data.stempel_url}
          busyKey="stempel"
          endpoint="/api/school/doc-stempel"
          field="file"
          icon={Stamp}
        />
        <UploadCard
          title="TTD Kepsek"
          hint="Untuk raport & surat resmi"
          current={data.kepala_ttd}
          busyKey="ttd_kepala"
          endpoint="/api/school/doc-ttd-kepala"
          field="file"
          icon={FileSignature}
        />
        <UploadCard
          title="TTD Bendahara"
          hint="Untuk kuitansi pembayaran"
          current={data.bendahara_ttd}
          busyKey="ttd_bendahara"
          endpoint="/api/school/doc-ttd-bendahara"
          field="file"
          icon={FileSignature}
        />
      </div>

      <div className="bg-white rounded-2xl border border-warm/60 p-5 space-y-4">
        <h2 className="font-extrabold text-navy">Identitas Pejabat</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nama Yayasan (opsional)" v={data.yayasan_name}
                 onChange={v => setData({ ...data, yayasan_name: v })}
                 placeholder="YAYASAN NUSANTARA" />
          <Field label="Kabupaten/Kota" v={data.kabupaten}
                 onChange={v => setData({ ...data, kabupaten: v })}
                 placeholder="Bandung" />

          <Field label="Nama Kepala Sekolah" v={data.kepala_name}
                 onChange={v => setData({ ...data, kepala_name: v })}
                 placeholder="Drs. H. Budi Santoso, M.Pd" />
          <Field label="NIP Kepala Sekolah" v={data.kepala_nip}
                 onChange={v => setData({ ...data, kepala_nip: v })}
                 placeholder="196501012001011001" />

          <Field label="Nama Bendahara" v={data.bendahara_name}
                 onChange={v => setData({ ...data, bendahara_name: v })}
                 placeholder="Siti Aminah, S.E" />
          <Field label="NIP Bendahara" v={data.bendahara_nip}
                 onChange={v => setData({ ...data, bendahara_nip: v })}
                 placeholder="197505152005012003" />
        </div>

        <button onClick={saveText} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 gradient-warm text-white rounded-xl font-bold disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Identitas'}
        </button>
      </div>

      {/* Preview kuitansi mini */}
      <div className="bg-white rounded-2xl border border-warm/60 p-5">
        <h2 className="font-extrabold text-navy mb-3">Preview Kuitansi</h2>
        <div className="max-w-[280px] mx-auto bg-white border border-navy/30 p-4 rounded font-mono text-[11px] leading-tight text-black"
             style={{ width: '280px' }}>
          {data.logo_url && <img src={data.logo_url} alt="logo" className="w-12 h-12 mx-auto object-contain mb-1" />}
          <div className="text-center font-bold text-base">{school.name || 'Nama Sekolah'}</div>
          <div className="text-center">{school.address || 'Alamat'}</div>
          <div className="border-t border-dashed border-black my-2"></div>
          <div className="text-center font-bold">KUITANSI PEMBAYARAN</div>
          <div className="border-t border-dashed border-black my-2"></div>
          <div className="flex justify-between"><span>Untuk</span><span className="font-bold">SPP Mei</span></div>
          <div className="flex justify-between"><span>Dibayar</span><span className="font-bold">Rp 350.000</span></div>
          <div className="border-t border-dashed border-black my-2"></div>
          <div className="text-center text-[10px]">{data.kabupaten ? `${data.kabupaten}, ` : ''}24 Mei 2026</div>
          <div className="text-center text-[10px]">Bendahara,</div>
          <div className="relative h-16 my-1 flex items-center justify-center">
            {data.stempel_url && (
              <img src={data.stempel_url} alt="stempel"
                   className="absolute h-14 w-14 object-contain opacity-80"
                   style={{ left: '20%' }} />
            )}
            {data.bendahara_ttd && (
              <img src={data.bendahara_ttd} alt="ttd" className="h-12 object-contain relative" />
            )}
          </div>
          <div className="text-center font-bold underline">{data.bendahara_name || '(Nama Bendahara)'}</div>
          {data.bendahara_nip && <div className="text-center text-[9px]">NIP. {data.bendahara_nip}</div>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, v, onChange, placeholder }: {
  label: string; v: string; onChange: (s: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-navy/80 mb-1">{label}</label>
      <input type="text" value={v} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             className="w-full px-3 py-2 rounded-xl border border-warm/60 focus:ring-2 focus:ring-amber-warm/40 outline-none" />
    </div>
  )
}
