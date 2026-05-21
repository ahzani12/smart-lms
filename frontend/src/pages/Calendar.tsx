import { useState, useEffect } from 'react'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Plus, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const TYPE_COLORS: Record<string, string> = {
  ujian: 'bg-rose/15 text-rose',
  libur: 'bg-mint/15 text-mint',
  kegiatan: 'bg-sky-warm/15 text-sky-warm',
  rapat: 'bg-coral/15 text-coral',
  lainnya: 'bg-amber-soft/40 text-navy/80',
}

export default function Calendar() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<any>({ type: 'kegiatan', start_date: '', end_date: '', title: '' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    setLoading(true)
    axios.get(`/api/calendar/events?month=${monthStr}`).then(res => {
      setEvents(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [monthStr])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)

  const handleCreate = async () => {
    try {
      await axios.post('/api/calendar/events', form)
      toast.success('Event dibuat')
      setShowModal(false)
      setEvents([...events, { ...form, id: Date.now() }])
    } catch { toast.error('Gagal membuat event') }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Kalender Akademik</h1>
        <div className="flex gap-2">
          <button onClick={async () => {
            try {
              const r = await axios.post('/api/calendar/sync-libur-nasional?year=2026')
              toast.success(`Sync selesai: ${r.data.added} ditambah, ${r.data.skipped} sudah ada`)
              const res = await axios.get(`/api/calendar/events?month=${monthStr}`)
              setEvents(res.data)
            } catch { toast.error('Gagal sync libur nasional') }
          }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm">
            <Download className="w-4 h-4" /> Sync Libur Nasional
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-warm text-white rounded-xl hover:bg-amber-warm text-sm">
            <Plus className="w-4 h-4" /> Tambah Event
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 rounded-lg hover:bg-amber-soft/40"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 rounded-lg hover:bg-amber-soft/40"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-warm" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-navy/60 py-2">{d}</div>)}
            {days.map((day, i) => (
              <div key={i} className={`min-h-24 p-1 rounded-lg ${day ? 'bg-cream-soft border border-warm/40' : ''}`}>
                {day && (
                  <>
                    <div className="text-sm font-medium text-navy/80 mb-1">{day}</div>
                    {events.filter(e => {
                      const d = new Date(e.start_date).getDate()
                      return d === day
                    }).map(e => (
                      <div key={e.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${TYPE_COLORS[e.type] || TYPE_COLORS.lainnya}`}>
                        {e.title}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">Tambah Event</h2>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Judul</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">Tanggal Mulai</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy/80 mb-1">Tanggal Selesai</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy/80 mb-1">Tipe</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-amber-warm/40 outline-none">
                <option value="ujian">Ujian</option>
                <option value="libur">Libur</option>
                <option value="kegiatan">Kegiatan</option>
                <option value="rapat">Rapat</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border hover:bg-cream-soft">Batal</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl gradient-warm text-white hover:shadow-warm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
