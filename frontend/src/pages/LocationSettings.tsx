import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { MapPin, Save, Crosshair, Shield, Activity, AlertCircle } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getCurrentPositionSafe } from '../utils/geolocation'

// Fix default marker icons di Leaflet (asset paths broken di Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Default: Jakarta center kalau sekolah belum set lokasi
const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456]

interface LocationConfig {
  latitude: number | null
  longitude: number | null
  attendance_radius_m: number
  gps_required: boolean
  gps_max_accuracy_m: number
  gps_max_location_age_s: number
}

interface LocationLog {
  id: number
  user_name: string
  latitude: number
  longitude: number
  accuracy_m: number
  distance_m: number
  ip_address: string
  action: string
  allowed: boolean
  reject_reason: string
  created_at: string
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  })
  return null
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 16 ? 17 : map.getZoom())
  }, [lat, lng])
  return null
}

export default function LocationSettings() {
  const [cfg, setCfg] = useState<LocationConfig>({
    latitude: null,
    longitude: null,
    attendance_radius_m: 150,
    gps_required: false,
    gps_max_accuracy_m: 100,
    gps_max_location_age_s: 60,
  })
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [logs, setLogs] = useState<LocationLog[]>([])
  const [stats, setStats] = useState({ allowed: 0, rejected: 0 })
  const [showLogs, setShowLogs] = useState(false)
  const [onlyRejected, setOnlyRejected] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (showLogs) loadLogs()
  }, [showLogs, onlyRejected])

  const loadConfig = async () => {
    try {
      const r = await axios.get('/api/school/location')
      setCfg({
        latitude: r.data.latitude,
        longitude: r.data.longitude,
        attendance_radius_m: r.data.attendance_radius_m || 150,
        gps_required: r.data.gps_required || false,
        gps_max_accuracy_m: r.data.gps_max_accuracy_m || 100,
        gps_max_location_age_s: r.data.gps_max_location_age_s || 60,
      })
    } catch {
      toast.error('Gagal load config lokasi')
    }
  }

  const loadLogs = async () => {
    try {
      const r = await axios.get('/api/school/location-logs', {
        params: { days: 7, only_rejected: onlyRejected ? 'true' : undefined },
      })
      setLogs(r.data.logs || [])
      setStats({ allowed: r.data.total_allowed, rejected: r.data.total_rejected })
    } catch {
      toast.error('Gagal load audit log')
    }
  }

  const detectMyLocation = async () => {
    setDetecting(true)
    const result = await getCurrentPositionSafe({ maxAccuracyM: 200, timeoutMs: 12000 })
    setDetecting(false)
    if (!result.ok) {
      toast.error(result.error.message, { duration: 5000 })
      return
    }
    setCfg({
      ...cfg,
      latitude: result.reading.latitude,
      longitude: result.reading.longitude,
    })
    toast.success(`Lokasi ditemukan (akurasi ${Math.round(result.reading.accuracy_m)}m)`)
  }

  const handleMapClick = (lat: number, lng: number) => {
    setCfg({ ...cfg, latitude: lat, longitude: lng })
  }

  const handleSave = async () => {
    if (cfg.gps_required && (cfg.latitude === null || cfg.longitude === null)) {
      toast.error('Set koordinat sekolah dulu sebelum mengaktifkan GPS wajib')
      return
    }
    setSaving(true)
    try {
      await axios.put('/api/school/location', cfg)
      toast.success('Pengaturan lokasi disimpan')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Gagal menyimpan')
    }
    setSaving(false)
  }

  const center: [number, number] =
    cfg.latitude !== null && cfg.longitude !== null
      ? [cfg.latitude, cfg.longitude]
      : DEFAULT_CENTER

  const rejectReasonLabel = (r: string) => {
    const map: Record<string, string> = {
      distance: '📍 Di luar radius',
      accuracy_high: '📡 Akurasi rendah',
      stale: '⏱ Lokasi cached',
      speed: '🚀 Pergerakan tidak wajar',
      no_gps: '❌ GPS tidak dikirim',
      no_school_coords: '⚠️ Lokasi sekolah belum di-set',
    }
    return map[r] || r
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <MapPin className="w-6 h-6 text-amber-warm" />
          Lokasi & Anti Fake-GPS
        </h1>
        <p className="text-navy/60">
          Atur titik lokasi sekolah dan radius valid untuk absensi guru.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white rounded-2xl border p-6 space-y-5">
          <h2 className="font-semibold text-navy flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-warm" />
            Pengaturan
          </h2>

          {/* Toggle GPS Required */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-soft/30 border border-amber-warm/30">
            <input
              type="checkbox"
              id="gps_required"
              checked={cfg.gps_required}
              onChange={(e) => setCfg({ ...cfg, gps_required: e.target.checked })}
              className="mt-1 w-4 h-4 accent-amber-warm"
            />
            <label htmlFor="gps_required" className="flex-1 cursor-pointer">
              <div className="font-medium text-navy">Wajib GPS untuk absensi</div>
              <div className="text-xs text-navy/60 mt-1">
                Guru yang ada di luar radius tidak bisa membuka sesi absensi.
              </div>
            </label>
          </div>

          {/* Coordinates */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-navy/80">
              Koordinat Sekolah
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.000001"
                value={cfg.latitude ?? ''}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    latitude: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                placeholder="Latitude"
                className="px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-amber-warm/40 outline-none"
              />
              <input
                type="number"
                step="0.000001"
                value={cfg.longitude ?? ''}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    longitude: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                placeholder="Longitude"
                className="px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-amber-warm/40 outline-none"
              />
            </div>
            <button
              onClick={detectMyLocation}
              disabled={detecting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-soft/40 text-navy/80 rounded-xl hover:bg-warm text-sm disabled:opacity-50"
            >
              <Crosshair className="w-4 h-4" />
              {detecting ? 'Mendeteksi...' : 'Pakai Lokasi Saya Sekarang'}
            </button>
            <p className="text-xs text-navy/50">
              Atau klik di peta untuk set titik lokasi.
            </p>
          </div>

          {/* Radius slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-navy/80">Radius Valid</label>
              <span className="font-mono text-sm font-semibold text-amber-warm">
                {cfg.attendance_radius_m}m
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={500}
              step={10}
              value={cfg.attendance_radius_m}
              onChange={(e) =>
                setCfg({ ...cfg, attendance_radius_m: parseInt(e.target.value) })
              }
              className="w-full accent-amber-warm"
            />
            <div className="flex justify-between text-xs text-navy/50">
              <span>20m (gedung)</span>
              <span>150m (default)</span>
              <span>500m (luas)</span>
            </div>
          </div>

          {/* Advanced */}
          <details className="group">
            <summary className="text-sm font-medium text-navy/70 cursor-pointer hover:text-amber-warm">
              Pengaturan Lanjut
            </summary>
            <div className="space-y-3 mt-3 pl-2 border-l-2 border-amber-soft">
              <div>
                <label className="block text-xs text-navy/60 mb-1">
                  Akurasi GPS maksimal: {cfg.gps_max_accuracy_m}m
                </label>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={10}
                  value={cfg.gps_max_accuracy_m}
                  onChange={(e) =>
                    setCfg({ ...cfg, gps_max_accuracy_m: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-warm"
                />
                <p className="text-xs text-navy/40">
                  Reading dengan accuracy &gt; nilai ini ditolak (kemungkinan WiFi-loc, bukan GPS).
                </p>
              </div>
              <div>
                <label className="block text-xs text-navy/60 mb-1">
                  Umur reading max: {cfg.gps_max_location_age_s}s
                </label>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={10}
                  value={cfg.gps_max_location_age_s}
                  onChange={(e) =>
                    setCfg({ ...cfg, gps_max_location_age_s: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-warm"
                />
                <p className="text-xs text-navy/40">
                  Lokasi cached lebih lama dari ini akan ditolak.
                </p>
              </div>
            </div>
          </details>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-warm text-white rounded-xl hover:bg-amber-warm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy">Peta</h2>
            <span className="text-xs text-navy/50">Klik untuk pindahkan titik</span>
          </div>
          <div className="rounded-xl overflow-hidden h-[450px] border">
            <MapContainer
              center={center}
              zoom={cfg.latitude !== null ? 17 : 12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onClick={handleMapClick} />
              {cfg.latitude !== null && cfg.longitude !== null && (
                <>
                  <MapRecenter lat={cfg.latitude} lng={cfg.longitude} />
                  <Marker position={[cfg.latitude, cfg.longitude]} />
                  <Circle
                    center={[cfg.latitude, cfg.longitude]}
                    radius={cfg.attendance_radius_m}
                    pathOptions={{ color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.2 }}
                  />
                </>
              )}
            </MapContainer>
          </div>
          <p className="text-xs text-navy/50">
            Lingkaran kuning menunjukkan radius valid (
            {cfg.attendance_radius_m}m). Guru harus berada di dalam lingkaran ini agar bisa absen.
          </p>
        </div>
      </div>

      {/* Audit Log Toggle */}
      <div className="bg-white rounded-2xl border p-6">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-warm" />
            <h2 className="font-semibold text-navy">Audit Log Absensi (7 hari)</h2>
          </div>
          <span className="text-sm text-navy/60">{showLogs ? 'Sembunyikan ▲' : 'Tampilkan ▼'}</span>
        </button>

        {showLogs && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="px-3 py-1 rounded-full bg-mint/20 text-mint">
                ✓ Allowed: {stats.allowed}
              </div>
              <div className="px-3 py-1 rounded-full bg-rose/20 text-rose">
                ✗ Rejected: {stats.rejected}
              </div>
              <label className="ml-auto flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyRejected}
                  onChange={(e) => setOnlyRejected(e.target.checked)}
                  className="accent-amber-warm"
                />
                <span className="text-navy/70">Hanya tampilkan rejected</span>
              </label>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-navy/40">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>Belum ada log dalam 7 hari terakhir</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-navy/60">
                      <th className="py-2 px-2">Waktu</th>
                      <th className="py-2 px-2">Guru</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Jarak</th>
                      <th className="py-2 px-2">Akurasi</th>
                      <th className="py-2 px-2">Alasan</th>
                      <th className="py-2 px-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-cream-soft/50">
                        <td className="py-2 px-2 text-xs text-navy/60">
                          {new Date(l.created_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-2">{l.user_name || `User #${l.id}`}</td>
                        <td className="py-2 px-2">
                          {l.allowed ? (
                            <span className="text-mint">✓ OK</span>
                          ) : (
                            <span className="text-rose">✗ Reject</span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {Math.round(l.distance_m)}m
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {Math.round(l.accuracy_m)}m
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {l.reject_reason ? rejectReasonLabel(l.reject_reason) : '—'}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs text-navy/50">
                          {l.ip_address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
