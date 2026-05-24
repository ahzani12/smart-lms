import { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Bell, MessageCircle, Send, Save, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, Loader2, History, Trash2, Smartphone,
} from 'lucide-react'

type Provider = 'none' | 'fonnte' | 'wablas' | 'telegram'

type Config = {
  id?: number
  school_id: number
  provider: Provider
  enabled: boolean
  sender_number: string
  device_id: string
  api_key_set: boolean
  api_key_masked?: string
  events: Record<string, boolean>
}

type QueueItem = {
  id: number
  event: string
  recipient: string
  message: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  retries: number
  last_error: string
  provider: string
  created_at: string
  sent_at?: string
}

const PROVIDER_INFO: Record<Provider, { label: string; desc: string; cost: string; setupUrl?: string }> = {
  none: {
    label: 'Tidak Aktif',
    desc: 'Sistem tidak mengirim notifikasi WA/Telegram.',
    cost: 'Gratis',
  },
  fonnte: {
    label: 'Fonnte (WhatsApp)',
    desc: 'Gateway WA paling populer di Indonesia. Scan QR pakai HP, copy token.',
    cost: 'Mulai Rp 100k/bulan',
    setupUrl: 'https://fonnte.com',
  },
  wablas: {
    label: 'Wablas (WhatsApp)',
    desc: 'Alternatif Fonnte. Token + domain device.',
    cost: 'Mulai Rp 50k/bulan',
    setupUrl: 'https://wablas.com',
  },
  telegram: {
    label: 'Telegram Bot',
    desc: 'Gratis selamanya. Buat bot via @BotFather, masukin bot token. Ortu chat /start ke bot dulu.',
    cost: 'Gratis',
    setupUrl: 'https://t.me/BotFather',
  },
}

const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
  alfa: { label: 'Siswa Alfa', desc: 'Kirim pesan ke ortu kalau anak tidak hadir' },
  terlambat: { label: 'Siswa Terlambat', desc: 'Kirim pesan kalau anak terlambat masuk' },
  nilai_keluar: { label: 'Nilai Ujian Keluar', desc: 'Notif kalau guru selesai grading' },
  raport_siap: { label: 'Raport Siap', desc: 'Notif kalau raport semester di-generate' },
  tagihan: { label: 'Tagihan SPP/Iuran', desc: 'Reminder tagihan baru' },
  lunas: { label: 'Pembayaran Lunas', desc: 'Konfirmasi pembayaran diterima' },
  pelanggaran: { label: 'Pelanggaran Siswa', desc: 'Notif kalau ada catatan pelanggaran' },
  pengumuman: { label: 'Pengumuman Sekolah', desc: 'Broadcast manual dari admin' },
}

export default function NotificationSettings() {
  const [tab, setTab] = useState<'config' | 'history'>('config')
  const [cfg, setCfg] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [testNumber, setTestNumber] = useState('')
  const [testing, setTesting] = useState(false)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [stats, setStats] = useState({ pending: 0, sending: 0, sent: 0, failed: 0 })
  const [filterStatus, setFilterStatus] = useState('')

  const loadConfig = async () => {
    try {
      const r = await axios.get('/api/notifications/config')
      setCfg(r.data)
    } catch (e: any) {
      toast.error('Gagal load konfigurasi')
    } finally {
      setLoading(false)
    }
  }

  const loadQueue = async () => {
    try {
      const r = await axios.get('/api/notifications/queue', { params: { status: filterStatus, limit: 100 } })
      setQueue(r.data.data || [])
      setStats(r.data.stats || { pending: 0, sending: 0, sent: 0, failed: 0 })
    } catch {
      // silent
    }
  }

  useEffect(() => { loadConfig() }, [])
  useEffect(() => { if (tab === 'history') loadQueue() }, [tab, filterStatus])

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      await axios.put('/api/notifications/config', {
        provider: cfg.provider,
        api_key: apiKeyInput, // kosong = jangan ubah
        device_id: cfg.device_id,
        sender_number: cfg.sender_number,
        enabled: cfg.enabled,
        events: cfg.events,
      })
      toast.success('Konfigurasi tersimpan')
      setApiKeyInput('')
      loadConfig()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    if (!testNumber) {
      toast.error('Isi nomor/chat_id penerima dulu')
      return
    }
    setTesting(true)
    try {
      const r = await axios.post('/api/notifications/test', {
        recipient: testNumber,
        message: `🔔 Test dari ${cfg?.sender_number || 'SSD'} — ${new Date().toLocaleString('id-ID')}`,
      })
      if (r.data.success) {
        toast.success(`Terkirim via ${r.data.provider}!`)
      } else {
        toast.error(r.data.error || 'Gagal kirim')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal test')
    } finally {
      setTesting(false)
    }
  }

  const retry = async (id: number) => {
    try {
      await axios.post(`/api/notifications/queue/${id}/retry`)
      toast.success('Akan dikirim ulang')
      loadQueue()
    } catch {
      toast.error('Gagal retry')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Hapus notifikasi ini dari riwayat?')) return
    try {
      await axios.delete(`/api/notifications/queue/${id}`)
      loadQueue()
    } catch {
      toast.error('Gagal hapus')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-navy/60">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
      </div>
    )
  }
  if (!cfg) return null

  const info = PROVIDER_INFO[cfg.provider]

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-soft flex items-center justify-center">
          <Bell className="w-6 h-6 text-amber-warm" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Notifikasi WA / Telegram</h1>
          <p className="text-sm text-navy/60">Kirim pesan otomatis ke ortu — opsional, aktifkan kalau perlu.</p>
        </div>
      </div>

      <div className="flex gap-1.5 bg-white border border-warm/60 rounded-2xl p-1.5 shadow-card w-fit">
        <button
          onClick={() => setTab('config')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
            tab === 'config' ? 'gradient-warm text-white shadow-warm-sm' : 'text-navy/60 hover:bg-amber-soft/50'
          }`}
        >
          ⚙ Konfigurasi
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
            tab === 'history' ? 'gradient-warm text-white shadow-warm-sm' : 'text-navy/60 hover:bg-amber-soft/50'
          }`}
        >
          <History className="w-4 h-4 inline mr-1" /> Riwayat
        </button>
      </div>

      {tab === 'config' ? (
        <div className="space-y-5">
          {/* Master toggle */}
          <div className="bg-white rounded-3xl border border-warm/60 p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-navy">Aktifkan Notifikasi</h2>
                <p className="text-sm text-navy/60 mt-1">
                  {cfg.enabled ? 'Sistem akan mengirim pesan saat event trigger.' : 'Mati. Sistem tidak kirim apa-apa.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-7 bg-navy/15 peer-checked:bg-amber-warm rounded-full transition relative">
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition shadow ${cfg.enabled ? 'left-6' : 'left-1'}`} />
                </div>
              </label>
            </div>
          </div>

          {/* Provider picker */}
          <div className="bg-white rounded-3xl border border-warm/60 p-5 shadow-card">
            <h2 className="font-extrabold text-navy mb-3">Pilih Provider</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(PROVIDER_INFO) as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setCfg({ ...cfg, provider: p })}
                  className={`text-left p-4 rounded-2xl border-2 transition ${
                    cfg.provider === p
                      ? 'border-amber-warm bg-amber-soft/40 shadow-warm-sm'
                      : 'border-warm/60 hover:border-amber-warm/50 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-navy">{PROVIDER_INFO[p].label}</span>
                    {cfg.provider === p && <CheckCircle2 className="w-5 h-5 text-amber-warm" />}
                  </div>
                  <p className="text-xs text-navy/60 mb-2">{PROVIDER_INFO[p].desc}</p>
                  <span className="inline-block text-[10px] font-bold px-2 py-1 bg-mint/15 text-mint rounded">
                    {PROVIDER_INFO[p].cost}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Provider-specific config */}
          {cfg.provider !== 'none' && (
            <div className="bg-white rounded-3xl border border-warm/60 p-5 shadow-card space-y-4">
              <div>
                <h2 className="font-extrabold text-navy">Kredensial {info.label}</h2>
                {info.setupUrl && (
                  <a href={info.setupUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-warm hover:underline">
                    Setup di {info.setupUrl} →
                  </a>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-navy mb-1 block">
                  {cfg.provider === 'telegram' ? 'Bot Token' : 'API Key / Token'}
                </label>
                {cfg.api_key_set && !apiKeyInput && (
                  <div className="text-xs text-navy/60 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-mint" />
                    Tersimpan: <code className="bg-cream-soft px-2 py-0.5 rounded">{cfg.api_key_masked}</code>
                    <span className="text-navy/40">— kosongkan input untuk pertahankan, atau isi untuk ganti</span>
                  </div>
                )}
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={cfg.api_key_set ? 'Biarkan kosong jika tidak diubah' : 'Paste API key/token disini'}
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm font-mono text-sm"
                />
              </div>

              {cfg.provider === 'wablas' && (
                <div>
                  <label className="text-sm font-bold text-navy mb-1 block">Domain Device</label>
                  <input
                    value={cfg.device_id}
                    onChange={(e) => setCfg({ ...cfg, device_id: e.target.value })}
                    placeholder="contoh: tegal.wablas.com"
                    className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm"
                  />
                  <p className="text-xs text-navy/60 mt-1">Bisa lihat di dashboard Wablas, copy domain device.</p>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-navy mb-1 block">Nomor Pengirim (info display)</label>
                <input
                  value={cfg.sender_number}
                  onChange={(e) => setCfg({ ...cfg, sender_number: e.target.value })}
                  placeholder="contoh: 081234567890"
                  className="w-full px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm"
                />
              </div>

              {/* Test send */}
              <div className="pt-3 border-t border-warm/60">
                <h3 className="font-bold text-navy mb-2 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> Tes Kirim
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    placeholder={cfg.provider === 'telegram' ? 'chat_id (angka)' : 'Nomor WA contoh: 0812xxx'}
                    className="flex-1 px-4 py-3 rounded-xl border border-warm/60 bg-cream-soft focus:outline-none focus:border-amber-warm"
                  />
                  <button
                    onClick={test}
                    disabled={testing || !cfg.api_key_set && !apiKeyInput}
                    className="px-5 py-3 gradient-warm text-white rounded-xl font-bold hover:shadow-warm disabled:opacity-50 flex items-center gap-2 justify-center"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Kirim Tes
                  </button>
                </div>
                <p className="text-xs text-navy/60 mt-2">
                  ⚠ Save dulu konfigurasi sebelum tes. Tes baru pakai credential yang udah disimpan.
                </p>
              </div>
            </div>
          )}

          {/* Event toggles */}
          {cfg.provider !== 'none' && (
            <div className="bg-white rounded-3xl border border-warm/60 p-5 shadow-card">
              <h2 className="font-extrabold text-navy mb-3">Event Yang Dikirim</h2>
              <p className="text-sm text-navy/60 mb-4">Pilih event mana aja yang trigger notifikasi WA.</p>
              <div className="space-y-2">
                {Object.entries(EVENT_LABELS).map(([key, val]) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-cream-soft cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={cfg.events[key] || false}
                      onChange={(e) => setCfg({ ...cfg, events: { ...cfg.events, [key]: e.target.checked } })}
                      className="mt-1 w-4 h-4 accent-amber-warm"
                    />
                    <div>
                      <div className="font-bold text-navy text-sm">{val.label}</div>
                      <div className="text-xs text-navy/60">{val.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Save bar */}
          <div className="sticky bottom-20 lg:bottom-4 z-20 flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-3 gradient-warm text-white rounded-2xl font-extrabold hover:shadow-warm disabled:opacity-50 flex items-center gap-2 shadow-warm-sm"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Pending', val: stats.pending, color: 'text-amber-warm', bg: 'bg-amber-soft' },
              { label: 'Sending', val: stats.sending, color: 'text-sky-warm', bg: 'bg-sky-warm/15' },
              { label: 'Sent', val: stats.sent, color: 'text-mint', bg: 'bg-mint/15' },
              { label: 'Failed', val: stats.failed, color: 'text-rose', bg: 'bg-rose/15' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
                <div className={`text-3xl font-extrabold ${s.color}`}>{s.val}</div>
                <div className="text-xs font-bold text-navy/60 uppercase tracking-wide mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex gap-2 items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-warm/60 bg-white text-sm"
            >
              <option value="">Semua status</option>
              <option value="pending">Pending</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <button onClick={loadQueue} className="px-3 py-2 bg-white border border-warm/60 rounded-xl hover:bg-amber-soft text-navy/70">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Queue list */}
          {queue.length === 0 ? (
            <div className="bg-white rounded-3xl border border-warm/60 p-10 text-center">
              <MessageCircle className="w-12 h-12 text-navy/20 mx-auto mb-3" />
              <p className="text-navy/60">Belum ada riwayat notifikasi.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((q) => (
                <div key={q.id} className="bg-white rounded-2xl border border-warm/60 p-4 hover:shadow-card transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusPill status={q.status} />
                        <span className="text-[10px] font-bold uppercase bg-amber-soft text-amber-warm px-2 py-0.5 rounded">
                          {q.event}
                        </span>
                        <span className="text-[10px] text-navy/40">via {q.provider}</span>
                        {q.retries > 0 && (
                          <span className="text-[10px] text-rose">retry {q.retries}x</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-navy">→ {q.recipient}</div>
                      <div className="text-xs text-navy/70 mt-1 line-clamp-2 whitespace-pre-line">{q.message}</div>
                      {q.last_error && (
                        <div className="mt-2 text-xs text-rose flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{q.last_error}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-navy/40 mt-2">
                        {new Date(q.created_at).toLocaleString('id-ID')}
                        {q.sent_at && ` → terkirim ${new Date(q.sent_at).toLocaleString('id-ID')}`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {q.status === 'failed' && (
                        <button onClick={() => retry(q.id)} title="Kirim ulang" className="p-2 rounded-lg hover:bg-amber-soft text-amber-warm">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => remove(q.id)} title="Hapus" className="p-2 rounded-lg hover:bg-rose/10 text-rose">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: QueueItem['status'] }) {
  const map = {
    pending: { label: 'PENDING', cls: 'bg-amber-warm/15 text-amber-warm' },
    sending: { label: 'SENDING', cls: 'bg-sky-warm/15 text-sky-warm' },
    sent: { label: 'TERKIRIM', cls: 'bg-mint/15 text-mint' },
    failed: { label: 'GAGAL', cls: 'bg-rose/15 text-rose' },
  }
  const m = map[status]
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${m.cls}`}>
      {status === 'sent' && <CheckCircle2 className="w-3 h-3 inline mr-0.5" />}
      {status === 'failed' && <XCircle className="w-3 h-3 inline mr-0.5" />}
      {m.label}
    </span>
  )
}
