// Package notifications provides a pluggable notification system for sending
// messages via WhatsApp (Fonnte/Wablas), Telegram, or no-op when disabled.
//
// Adding a new provider:
//   1. Implement Notifier interface in a new file (e.g., signal.go)
//   2. Register in factory.go's switch statement
//   3. Add provider name to allowed list in handlers/notification.go
//
// Sekolah enable/disable via NotificationConfig table — sistem hot-reload
// config tiap kali kirim, gak butuh restart.
package notifications

// Notifier is the contract every provider must satisfy.
// Implementations live in fonnte.go, wablas.go, telegram.go, noop.go.
type Notifier interface {
	// Send delivers `message` to `to` (phone for WA, chat_id for Telegram).
	// Returns provider message ID on success (for tracking) and error if failed.
	Send(to, message string) (providerID string, err error)

	// Name returns provider identifier (e.g., "fonnte", "telegram").
	Name() string
}
