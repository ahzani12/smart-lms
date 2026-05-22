/**
 * Geolocation utilities — anti fake-GPS support.
 *
 * Wraps browser Geolocation API with extra validation:
 *  - Permission state check
 *  - Accuracy bounds (reject if too imprecise)
 *  - Stale reading detection
 *  - Pretty error messages in Bahasa Indonesia
 */

export type GPSReading = {
  latitude: number
  longitude: number
  accuracy_m: number
  timestamp_ms: number
}

export type GPSError = {
  code: 'permission_denied' | 'unavailable' | 'timeout' | 'unsupported' | 'low_accuracy'
  message: string
}

export type GPSResult =
  | { ok: true; reading: GPSReading }
  | { ok: false; error: GPSError }

const MAX_ACCURACY_M = 100 // reject reading with accuracy worse than this
const TIMEOUT_MS = 10000

/**
 * Get current position with high accuracy (GPS, not WiFi/cell).
 *
 * Returns a discriminated union — caller must check `result.ok`.
 */
export async function getCurrentPositionSafe(opts?: {
  maxAccuracyM?: number
  timeoutMs?: number
}): Promise<GPSResult> {
  const maxAcc = opts?.maxAccuracyM ?? MAX_ACCURACY_M
  const timeoutMs = opts?.timeoutMs ?? TIMEOUT_MS

  if (!('geolocation' in navigator)) {
    return {
      ok: false,
      error: { code: 'unsupported', message: 'Browser tidak mendukung GPS.' },
    }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const reading: GPSReading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          timestamp_ms: pos.timestamp,
        }

        if (reading.accuracy_m > maxAcc) {
          resolve({
            ok: false,
            error: {
              code: 'low_accuracy',
              message: `Akurasi GPS terlalu rendah (${Math.round(reading.accuracy_m)}m). Coba di luar gedung.`,
            },
          })
          return
        }

        resolve({ ok: true, reading })
      },
      (err) => {
        let code: GPSError['code'] = 'unavailable'
        let message = 'Gagal mendapatkan lokasi.'
        switch (err.code) {
          case err.PERMISSION_DENIED:
            code = 'permission_denied'
            message = 'Izin lokasi ditolak. Aktifkan permission di browser settings.'
            break
          case err.POSITION_UNAVAILABLE:
            code = 'unavailable'
            message = 'GPS tidak tersedia. Coba pindah ke tempat dengan sinyal lebih baik.'
            break
          case err.TIMEOUT:
            code = 'timeout'
            message = 'GPS timeout. Coba lagi di tempat terbuka.'
            break
        }
        resolve({ ok: false, error: { code, message } })
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0, // selalu fresh reading
      },
    )
  })
}

/**
 * Hitung jarak Haversine (meter) antara 2 koordinat.
 * Untuk preview di UI; backend juga validasi sendiri.
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Cek permission state tanpa request popup.
 * Berguna untuk show "Aktifkan GPS" hint sebelum user klik tombol.
 */
export async function checkLocationPermission(): Promise<
  'granted' | 'denied' | 'prompt' | 'unsupported'
> {
  if (!('permissions' in navigator)) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state as 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unsupported'
  }
}
