package models

import (
	"time"

	"gorm.io/gorm"
)

// JenisTagihan — master jenis tagihan (SPP, Seragam, Study Tour, Daftar Ulang, dll)
type JenisTagihan struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	SchoolID       uint           `json:"school_id" gorm:"index;not null"`
	School         School         `json:"-" gorm:"foreignKey:SchoolID"`
	Nama           string         `json:"nama" gorm:"not null"`            // "SPP", "Seragam", "Study Tour"
	Kode           string         `json:"kode"`                            // "SPP", "SRG", "ST" (kode pendek)
	Deskripsi      string         `json:"deskripsi"`                       // optional
	NominalDefault float64        `json:"nominal_default" gorm:"not null"` // default nominal saat generate
	Periode        string         `json:"periode" gorm:"not null"`         // "bulanan" | "sekali" | "tahunan"
	Aktif          bool           `json:"aktif" gorm:"default:true"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

// Tagihan — tagihan per siswa per periode
type Tagihan struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	SchoolID       uint           `json:"school_id" gorm:"index;not null"`
	School         School         `json:"-" gorm:"foreignKey:SchoolID"`
	StudentID      uint           `json:"student_id" gorm:"index;not null"`
	Student        Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	JenisTagihanID uint           `json:"jenis_tagihan_id" gorm:"index;not null"`
	JenisTagihan   JenisTagihan   `json:"jenis_tagihan,omitempty" gorm:"foreignKey:JenisTagihanID"`
	Periode        string         `json:"periode" gorm:"not null;index"` // "2026-05" untuk SPP bulanan, "2026-Ganjil" untuk semester
	Nominal        float64        `json:"nominal" gorm:"not null"`       // nominal asli
	Keringanan     float64        `json:"keringanan" gorm:"default:0"`   // diskon rupiah (mis. yatim 50% → keringanan = nominal*0.5)
	KeringananNote string         `json:"keringanan_note"`               // alasan: "Yatim", "KIP", "Saudara kandung"
	Terbayar       float64        `json:"terbayar" gorm:"default:0"`     // sum dari Pembayaran (cache)
	JatuhTempo     time.Time      `json:"jatuh_tempo"`
	Status         string         `json:"status" gorm:"default:'belum_bayar'"` // belum_bayar | sebagian | lunas | batal
	Catatan        string         `json:"catatan"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

// TotalTagihan menghitung nominal yang HARUS dibayar (sudah dikurangi keringanan)
func (t *Tagihan) TotalTagihan() float64 {
	return t.Nominal - t.Keringanan
}

// Sisa returns sisa yang belum dibayar (negatif kalau lebih bayar)
func (t *Tagihan) Sisa() float64 {
	return t.TotalTagihan() - t.Terbayar
}

// HitungStatus returns status berdasarkan total vs terbayar (gak save, tinggal di-set)
func (t *Tagihan) HitungStatus() string {
	if t.Status == "batal" {
		return "batal"
	}
	total := t.TotalTagihan()
	if t.Terbayar <= 0 {
		return "belum_bayar"
	}
	if t.Terbayar >= total {
		return "lunas"
	}
	return "sebagian"
}

// Pembayaran — riwayat cicilan/lunas
type Pembayaran struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	SchoolID      uint           `json:"school_id" gorm:"index;not null"`
	School        School         `json:"-" gorm:"foreignKey:SchoolID"`
	TagihanID     uint           `json:"tagihan_id" gorm:"index;not null"`
	Tagihan       Tagihan        `json:"tagihan,omitempty" gorm:"foreignKey:TagihanID"`
	StudentID     uint           `json:"student_id" gorm:"index;not null"` // denormalize buat filter cepat
	Student       Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	NominalBayar  float64        `json:"nominal_bayar" gorm:"not null"`
	TanggalBayar  time.Time      `json:"tanggal_bayar"`
	Metode        string         `json:"metode" gorm:"default:'cash'"` // cash | transfer | qris | va
	BuktiURL      string         `json:"bukti_url"`                    // upload bukti (optional)
	PetugasID     uint           `json:"petugas_id"`                   // user ID admin yang input
	PetugasNama   string         `json:"petugas_nama"`                 // cache nama supaya kuitansi gak bergantung ke user
	NomorKuitansi string         `json:"nomor_kuitansi" gorm:"uniqueIndex"`
	Catatan       string         `json:"catatan"`
	Void          bool           `json:"void" gorm:"default:false"`
	VoidReason    string         `json:"void_reason"`
	VoidAt        *time.Time     `json:"void_at"`
	VoidBy        uint           `json:"void_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}
