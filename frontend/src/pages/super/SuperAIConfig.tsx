import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Sparkles, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'

interface AIConfigItem {
  id: number; name: string; auth_type: string; base_url: string; api_key: string; model: string; active: boolean; is_global: boolean
}
interface QuotaItem {
  id: number; school_id: number; monthly_limit: number; used_this_month: number; reset_at: string; school?: { id: number; name: string }
}

export default function SuperAIConfig() {
  const [configs, setConfigs] = useState<AIConfigItem[]>([])
  const [quotas, setQuotas] = useState<QuotaItem[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [tab, setTab] = useState<'configs' | 'quotas'>('configs')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', auth_type: 'apikey', base_url: '', api_key: '', model: '' })
  const [quotaForm, setQuotaForm] = useState({ school_id: '', monthly_limit: '100' })

  const fetchData = () => {
    axios.get('/api/super/ai-configs').then(r => setConfigs(r.data || []))
    axios.get('/api/super/ai-quotas').then(r => setQuotas(r.data || []))
    axios.get('/api/super/schools').then(r => setSchools(r.data || []))
  }
  useEffect(() => { fetchData() }, [])

  const handleSaveConfig = async () => {
    try {
      if (editId) {
        await axios.put(`/api/super/ai-configs/${editId}`, form)
        toast.success('Config diupdate')
      } else {
        await axios.post('/api/super/ai-configs', { ...form, active: true })
        toast.success('Config ditambahkan')
      }
      setShowForm(false); setEditId(null)
      setForm({ name: '', auth_type: 'apikey', base_url: '', api_key: '', model: '' })
      fetchData()
    } catch { toast.error('Gagal menyimpan') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus config ini?')) return
    await axios.delete(`/api/super/ai-configs/${id}`)
    toast.success('Dihapus'); fetchData()
  }

  const handleToggle = async (item: AIConfigItem) => {
    await axios.put(`/api/super/ai-configs/${item.id}`, { active: !item.active })
    fetchData()
  }

  const handleSetQuota = async () => {
    try {
      await axios.post('/api/super/ai-quotas', { school_id: Number(quotaForm.school_id), monthly_limit: Number(quotaForm.monthly_limit) })
      toast.success('Quota diset')
      setQuotaForm({ school_id: '', monthly_limit: '100' })
      fetchData()
    } catch { toast.error('Gagal set quota') }
  }

  const handleResetQuota = async (schoolId: number) => {
    await axios.post(`/api/super/ai-quotas/${schoolId}/reset`)
    toast.success('Quota direset'); fetchData()
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-warm" />
          <h1 className="text-xl lg:text-2xl font-bold">AI Configuration</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button onClick={() => setTab('configs')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'configs' ? 'border-amber-warm text-amber-warm' : 'border-transparent text-navy/60'}`}>
          Provider & API Keys
        </button>
        <button onClick={() => setTab('quotas')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'quotas' ? 'border-amber-warm text-amber-warm' : 'border-transparent text-navy/60'}`}>
          Quota per Sekolah
        </button>
      </div>

      {tab === 'configs' && (
        <div className="space-y-4">
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', auth_type: 'apikey', base_url: '', api_key: '', model: '' }) }}
            className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm text-sm">
            <Plus className="w-4 h-4" /> Tambah Provider
          </button>

          <div className="grid gap-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="bg-white rounded-2xl p-4 border border-warm/40 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cfg.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.active ? 'bg-mint/15 text-mint' : 'bg-amber-soft/40 text-navy/60'}`}>
                      {cfg.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="text-sm text-navy/60 mt-1">Model: {cfg.model} • Key: {cfg.api_key || '***'}</div>
                  {cfg.base_url && <div className="text-xs text-navy/40">URL: {cfg.base_url}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(cfg)} className="p-2 hover:bg-amber-soft/40 rounded-lg">
                    {cfg.active ? <ToggleRight className="w-5 h-5 text-mint" /> : <ToggleLeft className="w-5 h-5 text-navy/40" />}
                  </button>
                  <button onClick={() => { setEditId(cfg.id); setForm({ name: cfg.name, auth_type: cfg.auth_type, base_url: cfg.base_url, api_key: '', model: cfg.model }); setShowForm(true) }}
                    className="p-2 hover:bg-amber-soft/40 rounded-lg"><Edit2 className="w-4 h-4 text-navy/70" /></button>
                  <button onClick={() => handleDelete(cfg.id)} className="p-2 hover:bg-rose/10 rounded-lg"><Trash2 className="w-4 h-4 text-rose" /></button>
                </div>
              </div>
            ))}
            {configs.length === 0 && <p className="text-navy/40 text-center py-8">Belum ada AI provider</p>}
          </div>
        </div>
      )}

      {tab === 'quotas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-warm/40 shadow-sm">
            <h3 className="font-medium mb-3">Set Quota Sekolah</h3>
            <div className="flex flex-wrap gap-3">
              <select value={quotaForm.school_id} onChange={e => setQuotaForm({ ...quotaForm, school_id: e.target.value })}
                className="px-3 py-2 rounded-xl border text-sm flex-1 min-w-[200px]">
                <option value="">Pilih Sekolah...</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" value={quotaForm.monthly_limit} onChange={e => setQuotaForm({ ...quotaForm, monthly_limit: e.target.value })}
                placeholder="Limit/bulan" className="px-3 py-2 rounded-xl border text-sm w-32" />
              <button onClick={handleSetQuota} className="px-4 py-2 gradient-warm text-white rounded-xl text-sm hover:bg-amber-warm">Set</button>
            </div>
          </div>

          <div className="grid gap-3">
            {quotas.map(q => (
              <div key={q.id} className="bg-white rounded-2xl p-4 border border-warm/40 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.school?.name || `School #${q.school_id}`}</div>
                  <div className="text-sm text-navy/60 mt-1">
                    Terpakai: <span className={q.used_this_month >= q.monthly_limit ? 'text-rose font-bold' : 'text-mint font-bold'}>{q.used_this_month}</span> / {q.monthly_limit}
                  </div>
                  <div className="text-xs text-navy/40">Reset: {new Date(q.reset_at).toLocaleDateString('id-ID')}</div>
                </div>
                <button onClick={() => handleResetQuota(q.school_id)} className="p-2 hover:bg-amber-soft/40 rounded-lg" title="Reset quota">
                  <RefreshCw className="w-4 h-4 text-navy/70" />
                </button>
              </div>
            ))}
            {quotas.length === 0 && <p className="text-navy/40 text-center py-8">Belum ada quota diset</p>}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">{editId ? 'Edit' : 'Tambah'} AI Provider</h2>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama (OpenAI, Gemini, xAI...)"
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            <select value={form.auth_type} onChange={e => setForm({ ...form, auth_type: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
              <option value="apikey">API Key</option>
              <option value="oauth">OAuth</option>
            </select>
            <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="Base URL (opsional, default OpenAI)"
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            <input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder="API Key" type="password"
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Model (gpt-4o, gemini-pro, grok-3...)"
              className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border text-navy/80 hover:bg-cream-soft">Batal</button>
              <button onClick={handleSaveConfig} className="px-4 py-2 rounded-xl gradient-warm text-white hover:shadow-warm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
