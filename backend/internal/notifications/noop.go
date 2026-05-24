package notifications

// NoopNotifier — fallback ketika sekolah belum aktifkan WA atau provider="none".
// Send selalu sukses tanpa kirim apa-apa, biar caller code gak perlu ngecek nil.
//
// Pattern ini kunci buat "WA opsional" — sistem tetap jalan normal walau
// sekolah gak konfigurasi notif sama sekali.
type NoopNotifier struct{}

func (n NoopNotifier) Name() string { return "none" }

func (n NoopNotifier) Send(to, message string) (string, error) {
	return "", nil
}
