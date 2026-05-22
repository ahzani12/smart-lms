package utils

import (
	"errors"
	"math"
	"time"
)

// ─── Geo utilities untuk anti-fake-GPS ─────────────────────────

// HaversineMeters menghitung jarak dua koordinat (lat/lng) dalam meter.
// Akurasi cukup untuk skala sekolah (radius ratusan meter).
func HaversineMeters(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000.0 // radius bumi dalam meter

	rad := func(d float64) float64 { return d * math.Pi / 180 }

	dLat := rad(lat2 - lat1)
	dLng := rad(lng2 - lng1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// ─── GPS validation ─────────────────────────────────────────────

// GPSCheck input — dikirim dari client.
type GPSReading struct {
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	AccuracyM    float64 `json:"accuracy_m"`
	TimestampMs  int64   `json:"timestamp_ms"` // ms epoch dari Geolocation API
}

// GPSValidationResult — hasil validasi.
type GPSValidationResult struct {
	Allowed      bool
	DistanceM    float64
	LocationAge  int    // detik
	RejectReason string // "distance" | "accuracy_high" | "accuracy_low" | "stale" | "no_school_coords"
	Message      string // pesan user-friendly Bahasa Indonesia
}

// ValidateGPS membandingkan reading client dengan koordinat sekolah.
//
// minAccuracyM: kalau accuracy < nilai ini → suspicious (GPS asli jarang
// segitu akurat; biasanya fake GPS app yang nge-set angka bulat).
// maxAccuracyM: kalau accuracy > nilai ini → location dari WiFi/cell, tolak.
// maxAgeSec: kalau timestamp > nilai detik dari sekarang → cached, tolak.
// radiusM: jarak max dari sekolah.
func ValidateGPS(
	r GPSReading,
	schoolLat, schoolLng *float64,
	radiusM int,
	maxAccuracyM int,
	maxAgeSec int,
) GPSValidationResult {
	res := GPSValidationResult{}

	if schoolLat == nil || schoolLng == nil {
		res.RejectReason = "no_school_coords"
		res.Message = "Lokasi sekolah belum diatur. Hubungi admin."
		return res
	}

	// 1. Accuracy bound check
	if r.AccuracyM > float64(maxAccuracyM) {
		res.RejectReason = "accuracy_high"
		res.Message = "Akurasi GPS terlalu rendah (" +
			itoa(int(r.AccuracyM)) + "m). Coba di luar gedung dengan langit terbuka."
		return res
	}
	// Accuracy < 3m sangat tidak natural — flag suspicious tapi tetap pass
	// (kalau strict reject bakal banyak false positive di iPhone modern).

	// 2. Stale location check
	if r.TimestampMs > 0 {
		ageSec := int((time.Now().UnixMilli() - r.TimestampMs) / 1000)
		if ageSec < 0 {
			ageSec = 0 // clock skew, treat as fresh
		}
		res.LocationAge = ageSec
		if ageSec > maxAgeSec {
			res.RejectReason = "stale"
			res.Message = "Lokasi GPS sudah lama (" +
				itoa(ageSec) + " detik). Refresh lokasi Anda."
			return res
		}
	}

	// 3. Distance check
	dist := HaversineMeters(*schoolLat, *schoolLng, r.Latitude, r.Longitude)
	res.DistanceM = dist
	if int(dist) > radiusM {
		res.RejectReason = "distance"
		res.Message = "Anda berada di luar area sekolah (" +
			itoa(int(dist)) + "m, max " + itoa(radiusM) + "m)."
		return res
	}

	// 4. All checks passed
	res.Allowed = true
	res.Message = "Lokasi terverifikasi (" + itoa(int(dist)) + "m dari sekolah)."
	return res
}

// CheckSpeed mengecek apakah user pindah lokasi terlalu cepat antara
// reading lama dan baru. Default speedLimit: 200 km/jam.
//
// Return: (isAnomaly, speedKmh)
func CheckSpeed(prevLat, prevLng float64, prevTime time.Time,
	curLat, curLng float64, curTime time.Time, speedLimitKmh float64) (bool, float64) {

	dt := curTime.Sub(prevTime).Seconds()
	if dt < 1 {
		return false, 0 // ignore reading dalam 1 detik (clock skew)
	}
	distM := HaversineMeters(prevLat, prevLng, curLat, curLng)
	speedKmh := (distM / 1000) / (dt / 3600)
	return speedKmh > speedLimitKmh, speedKmh
}

// itoa wrapper supaya gak import strconv dimana-mana
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// Errors
var (
	ErrInvalidGPS = errors.New("invalid GPS reading")
)
