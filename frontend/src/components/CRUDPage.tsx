import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Loader2, X, FileX, Save } from 'lucide-react'

interface Column { key: string; label: string; render?: (val: any, row: any) => any }

export default function CRUDPage({ title, endpoint, columns, formFields, extraActions }: {
  title: string
  endpoint: string
  columns: Column[]
  formFields: { key: string; label: string; type?: string; options?: { label: string; value: any }[] }[]
  extraActions?: React.ReactNode
}) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const fetchData = () => {
    setLoading(true)
    axios.get(`/api/${endpoint}`).then(res => {
      setData(Array.isArray(res.data) ? res.data : res.data.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [endpoint])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) {
        await axios.put(`/api/${endpoint}/${editItem.id}`, form)
        toast.success('Berhasil diupdate')
      } else {
        await axios.post(`/api/${endpoint}`, form)
        toast.success('Berhasil ditambahkan')
      }
      setShowModal(false)
      setEditItem(null)
      setForm({})
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus data ini?')) return
    try {
      await axios.delete(`/api/${endpoint}/${id}`)
      toast.success('Berhasil dihapus')
      fetchData()
    } catch { toast.error('Gagal menghapus') }
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({ ...item })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({})
    setShowModal(true)
  }

  const filtered = data.filter(row =>
    columns.some(col => {
      const raw = col.render ? col.render(row[col.key], row) : row[col.key]
      const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : String(row[col.key] || '')
      return text.toLowerCase().includes(search.toLowerCase())
    })
  )

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-navy">{title}</h1>
          <p className="text-sm text-navy/60 mt-0.5">
            {loading ? 'Memuat data...' : `${data.length} ${title.toLowerCase()} terdaftar`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {extraActions}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 gradient-warm text-white rounded-2xl font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Tambah
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" strokeWidth={2.4} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Cari ${title.toLowerCase()}...`}
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition placeholder:text-navy/40 text-sm font-semibold"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-amber-warm mb-3" strokeWidth={2.4} />
          <p className="text-navy/60 text-sm font-semibold">Memuat...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-warm/40 rounded-3xl py-16 px-6 text-center shadow-card">
          <div className="w-16 h-16 bg-amber-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileX className="w-8 h-8 text-amber-warm" strokeWidth={2.2} />
          </div>
          <h3 className="font-extrabold text-navy text-lg mb-1">
            {search ? 'Tidak ditemukan' : `Belum ada ${title.toLowerCase()}`}
          </h3>
          <p className="text-navy/60 text-sm mb-5">
            {search ? `Tidak ada hasil untuk "${search}"` : `Mulai dengan menambah ${title.toLowerCase()} pertama.`}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 gradient-warm text-white rounded-2xl font-bold text-sm hover:shadow-warm transition shadow-warm-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Tambah {title}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-3xl shadow-card border border-warm/40 overflow-hidden">
            <table className="w-full">
              <thead className="bg-amber-soft/40 border-b border-warm/40">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="px-6 py-4 text-left text-[11px] font-extrabold text-navy uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-[11px] font-extrabold text-navy uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm/30">
                {filtered.map(row => (
                  <tr key={row.id} className="hover:bg-cream-soft transition">
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-4 text-sm text-navy">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-2 rounded-xl hover:bg-amber-soft text-amber-warm transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2.4} />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-2 rounded-xl hover:bg-rose/10 text-rose transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.4} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map(row => {
              const primary = columns[0]
              const primaryVal = primary?.render ? primary.render(row[primary.key], row) : (row[primary?.key] || '-')
              const rest = columns.slice(1)
              return (
                <div
                  key={row.id}
                  className="bg-white border border-warm/40 rounded-2xl p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-extrabold text-amber-warm uppercase tracking-wider mb-0.5">
                        {primary?.label}
                      </div>
                      <div className="font-bold text-navy text-base truncate">{primaryVal}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-2 rounded-xl bg-amber-soft text-amber-warm"
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={2.4} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-2 rounded-xl bg-rose/10 text-rose"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  {rest.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-warm/30">
                      {rest.map(col => (
                        <div key={col.key} className="min-w-0">
                          <div className="text-[10px] font-bold text-navy/50 uppercase tracking-wide">
                            {col.label}
                          </div>
                          <div className="text-sm font-semibold text-navy truncate">
                            {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-cream w-full max-w-lg rounded-t-3xl lg:rounded-3xl shadow-card-lg max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-warm/40 flex items-center justify-between bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-navy">
                  {editItem ? 'Edit' : 'Tambah'} {title}
                </h2>
                <p className="text-xs text-navy/60 mt-0.5">
                  {editItem ? 'Perbarui data' : 'Isi formulir di bawah'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-amber-soft text-navy/60 hover:text-navy transition"
              >
                <X className="w-5 h-5" strokeWidth={2.4} />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {formFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-extrabold text-navy uppercase tracking-wide mb-1.5">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
                    >
                      <option value="">Pilih...</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={form[field.key] || ''}
                      onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy resize-none"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={form[field.key] || ''}
                      onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-warm/60 focus:ring-4 focus:ring-amber-warm/15 focus:border-amber-warm outline-none transition text-sm font-semibold text-navy"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white border-t border-warm/40 flex gap-3 safe-bottom">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-warm/60 text-navy font-bold text-sm hover:bg-amber-soft/40 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl gradient-warm text-white font-bold text-sm hover:shadow-warm transition shadow-warm-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="w-4 h-4" strokeWidth={2.5} /> Simpan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
