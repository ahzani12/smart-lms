import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import {
  Wallet, TrendingUp, AlertTriangle, CheckCircle2, Loader2,
  ArrowRight, Users, Receipt, Sparkles,
} from 'lucide-react'
import { formatRupiah } from '../../lib/billing'

type Stats = {
  total_tagihan: number
  total_terbayar: number
  total_keringanan: number
  total_tunggakan: number
  jumlah_lunas: number
  jumlah_sebagian: number
  jumlah_belum: number
  jumlah_siswa_nunggak: number
}

type Defaulter = {
  student_id: number
  student_name: string
  class_name: string
  tunggakan: number
  jumlah_tagihan: number
}

export default function BillingDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [defaulters, setDefaulters] = useState<Defaulter[]>([])
  const [bulanIni, setBulanIni] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/billing/dashboard').then(r => {
      setStats(r.data.stats)
      setDefaulters(r.data.top_defaulters || [])
      setBulanIni(r.data.pembayaran_bulan_ini || 0)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-navy/60">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-navy text-white p-6 lg:p-8 shadow-card-lg">
        <div className="absolute inset-0 grid-pattern opacity-20"></div>
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-amber-warm/20 rounded-full blur-3xl"></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-warm/80 text-sm font-bold mb-1">
            <Wallet className="w-4 h-4" /> KEUANGAN SEKOLAH
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold">Dashboard Tagihan & Pembayaran</h1>
          <p className="text-white/70 mt-1 text-sm">Pantau SPP, iuran, dan tunggakan siswa.</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="text-xs text-white/70 font-bold uppercase tracking-wide">Total Tagihan</div>
              <div className="text-xl lg:text-2xl font-extrabold mt-1">{formatRupiah(stats?.total_tagihan || 0)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="text-xs text-white/70 font-bold uppercase tracking-wide">Terbayar</div>
              <div className="text-xl lg:text-2xl font-extrabold mt-1 text-mint">{formatRupiah(stats?.total_terbayar || 0)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="text-xs text-white/70 font-bold uppercase tracking-wide">Keringanan</div>
              <div className="text-xl lg:text-2xl font-extrabold mt-1 text-amber-warm">{formatRupiah(stats?.total_keringanan || 0)}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <div className="text-xs text-white/70 font-bold uppercase tracking-wide">Tunggakan</div>
              <div className="text-xl lg:text-2xl font-extrabold mt-1 text-rose">{formatRupiah(stats?.total_tunggakan || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/billing/tagihan', icon: Receipt, label: 'Daftar Tagihan', color: 'bg-amber-soft text-amber-warm' },
          { to: '/billing/generate', icon: Sparkles, label: 'Generate Tagihan', color: 'bg-mint/15 text-mint' },
          { to: '/billing/jenis', icon: Wallet, label: 'Jenis Tagihan', color: 'bg-coral/15 text-coral' },
          { to: '/billing/tagihan?status=belum_bayar', icon: AlertTriangle, label: 'Tunggakan', color: 'bg-rose/15 text-rose' },
        ].map(a => (
          <Link key={a.to} to={a.to} className="bg-white border border-warm/60 rounded-2xl p-4 hover:shadow-card transition group">
            <div className={`w-10 h-10 rounded-xl ${a.color} flex items-center justify-center mb-3`}>
              <a.icon className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="font-bold text-navy text-sm">{a.label}</div>
            <ArrowRight className="w-4 h-4 text-navy/30 group-hover:text-amber-warm group-hover:translate-x-1 transition" />
          </Link>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2} label="Tagihan Lunas" value={stats?.jumlah_lunas || 0} color="text-mint" bg="bg-mint/10" />
        <StatCard icon={TrendingUp} label="Cicilan" value={stats?.jumlah_sebagian || 0} color="text-amber-warm" bg="bg-amber-soft" />
        <StatCard icon={AlertTriangle} label="Belum Bayar" value={stats?.jumlah_belum || 0} color="text-rose" bg="bg-rose/10" />
        <StatCard icon={Users} label="Siswa Menunggak" value={stats?.jumlah_siswa_nunggak || 0} color="text-coral" bg="bg-coral/10" />
      </div>

      {/* Bulan ini */}
      <div className="bg-white rounded-3xl border border-warm/60 p-5 shadow-card flex items-center justify-between">
        <div>
          <div className="text-xs text-navy/60 font-bold uppercase tracking-wide">Pembayaran Bulan Ini</div>
          <div className="text-2xl lg:text-3xl font-extrabold text-mint mt-1">{formatRupiah(bulanIni)}</div>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-mint/15 flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-mint" strokeWidth={2.2} />
        </div>
      </div>

      {/* Top defaulters */}
      <div className="bg-white rounded-3xl border border-warm/60 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-warm/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose" />
            <h2 className="font-extrabold text-navy">Top 10 Siswa Menunggak</h2>
          </div>
          <Link to="/billing/tagihan?status=belum_bayar" className="text-xs font-bold text-amber-warm hover:underline">
            Lihat semua →
          </Link>
        </div>
        {defaulters.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-mint mx-auto mb-3" />
            <p className="text-navy/60 font-bold">Tidak ada tunggakan! 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-warm/30">
            {defaulters.map((d, i) => (
              <Link key={d.student_id} to={`/billing/siswa/${d.student_id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-cream-soft">
                <div className="w-8 h-8 rounded-lg bg-rose/15 flex items-center justify-center text-rose font-extrabold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy truncate">{d.student_name}</div>
                  <div className="text-xs text-navy/60">
                    {d.class_name || '-'} • {d.jumlah_tagihan} tagihan menunggak
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-rose">{formatRupiah(d.tunggakan)}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-navy/30 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div className="bg-white rounded-2xl border border-warm/60 p-4 shadow-card">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={2.4} />
      </div>
      <div className="text-2xl font-extrabold text-navy">{value}</div>
      <div className="text-xs text-navy/60 font-bold uppercase tracking-wide">{label}</div>
    </div>
  )
}
