package assistant

import (
	"fmt"
	"strings"

	"smart-lms/internal/models"
)

// ResolvedNotif — output utk intent NOTIF.*
type ResolvedNotif struct {
	Scope        string         `json:"scope"`
	Title        string         `json:"title"`
	Student      *StudentInfo   `json:"student,omitempty"`
	Recipients   []NotifTarget  `json:"recipients,omitempty"`
	Pesan        string         `json:"pesan"`         // pesan akhir (setelah template formatting)
	PesanRaw     string         `json:"pesan_raw"`     // input asli user
	Template     string         `json:"template,omitempty"`
	Provider     string         `json:"provider,omitempty"`     // active provider
	NotifEnabled bool           `json:"notif_enabled"`          // school NotificationConfig.Enabled
	Errors       []string       `json:"errors,omitempty"`
	Warnings     []string       `json:"warnings,omitempty"`
}

type NotifTarget struct {
	UserID   uint   `json:"user_id,omitempty"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Relation string `json:"relation,omitempty"` // "ayah" / "ibu" / "wali" / "siswa"
}

// ResolveNotif — resolve siswa + kontak ortu + format pesan.
// Tidak mengirim apapun, hanya mempersiapkan preview.
func (r *Resolver) ResolveNotif(parsed ParsedNotif) *ResolvedNotif {
	out := &ResolvedNotif{
		Scope:    parsed.Scope,
		PesanRaw: parsed.Pesan,
		Template: parsed.Template,
	}

	students := r.FindStudents(parsed.StudentRaw, nil)
	if len(students) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf("Siswa '%s' tidak ditemukan", parsed.StudentRaw))
		out.Title = fmt.Sprintf("WA ortu %s", parsed.StudentRaw)
		return out
	}
	if len(students) > 1 {
		names := []string{}
		for i, s := range students {
			if i >= 3 {
				names = append(names, "...")
				break
			}
			cls := ""
			if s.Class != nil {
				cls = s.Class.Name
			}
			names = append(names, fmt.Sprintf("%s (%s)", s.User.Name, cls))
		}
		out.Errors = append(out.Errors, fmt.Sprintf(
			"Siswa '%s' ambigu: %s. Coba pakai nama lengkap", parsed.StudentRaw, strings.Join(names, ", ")))
		out.Title = fmt.Sprintf("WA ortu %s", parsed.StudentRaw)
		return out
	}

	st := students[0]
	className := ""
	if st.Class != nil {
		className = st.Class.Name
	}
	out.Student = &StudentInfo{
		ID: st.ID, Name: st.User.Name, NIS: st.NIS, ClassName: className,
	}
	out.Title = fmt.Sprintf("WA ortu %s", st.User.Name)

	// Cari kontak ortu/wali
	type parentRow struct {
		UserID   uint
		Name     string
		Phone    string
		Relation string
	}
	var pRows []parentRow
	r.DB.Table("parents AS p").
		Select("u.id AS user_id, u.name, u.phone, p.relation").
		Joins("JOIN users u ON u.id = p.user_id").
		Where("p.school_id = ?", r.SchoolID).
		Where("p.student_id = ?", st.ID).
		Where("p.deleted_at IS NULL").
		Where("u.phone IS NOT NULL AND u.phone <> ''").
		Scan(&pRows)

	for _, p := range pRows {
		out.Recipients = append(out.Recipients, NotifTarget{
			UserID:   p.UserID,
			Name:     p.Name,
			Phone:    p.Phone,
			Relation: p.Relation,
		})
	}

	// Fallback: kalau gak ada parent, coba phone siswa sendiri
	if len(out.Recipients) == 0 {
		var su models.User
		r.DB.Where("id = ?", st.UserID).First(&su)
		if su.Phone != "" {
			out.Recipients = append(out.Recipients, NotifTarget{
				UserID:   su.ID,
				Name:     su.Name,
				Phone:    su.Phone,
				Relation: "siswa",
			})
			out.Warnings = append(out.Warnings,
				"⚠️ Belum ada kontak ortu terdaftar — pakai nomor siswa sebagai fallback")
		}
	}

	if len(out.Recipients) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf(
			"Belum ada kontak (ortu/siswa) yg bisa dihubungi utk %s", st.User.Name))
	}

	// Format pesan akhir berdasarkan template
	out.Pesan = r.formatNotifMessage(parsed.Template, st.User.Name, className, parsed.Pesan)

	// Cek notif config
	cfg := r.loadNotifConfig()
	if cfg != nil {
		out.NotifEnabled = cfg.Enabled && cfg.Provider != "" && cfg.Provider != "none"
		out.Provider = cfg.Provider
	}
	if !out.NotifEnabled {
		out.Warnings = append(out.Warnings,
			"⚠️ Provider WA belum aktif — pesan akan masuk antrian, tapi tidak terkirim sampai provider di-enable")
	}

	return out
}

// formatNotifMessage — rapikan pesan akhir berdasarkan template.
// Tetap pakai pesan user asli, tapi tambahin opening yg sopan.
func (r *Resolver) formatNotifMessage(template, studentName, className, raw string) string {
	if raw == "" {
		raw = "ada info terkait kehadiran anak hari ini"
	}
	// Greeting + body + closing
	greeting := "Bapak/Ibu wali, "
	closing := "\n\nTerima kasih.\n— SSD School"

	body := raw
	// Bersihin tense pertama: "anak ga masuk" → bagus apa adanya
	// Buang prefix "anak"/"anaknya" duplicate kalau ada nama yg disebut
	// Final: bikin kalimat pendek.
	if className != "" {
		body = fmt.Sprintf("%s (%s) — %s", studentName, className, body)
	} else {
		body = fmt.Sprintf("%s — %s", studentName, body)
	}
	return greeting + body + closing
}

// loadNotifConfig — wrapper internal (avoid circular import dgn package notifications)
func (r *Resolver) loadNotifConfig() *models.NotificationConfig {
	var cfg models.NotificationConfig
	if err := r.DB.Where("school_id = ?", r.SchoolID).First(&cfg).Error; err != nil {
		return nil
	}
	return &cfg
}
