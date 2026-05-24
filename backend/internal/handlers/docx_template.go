package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"strings"
)

// ─── DOCX TEMPLATE GENERATOR ──────────────────────────────────────────
// Build minimal valid .docx (zip dgn 4 file: [Content_Types].xml,
// _rels/.rels, word/_rels/document.xml.rels, word/document.xml).

const ctTypesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const rootRelsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const docRelsXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

// xmlEscape escapes content for XML body.
func xmlEscape(s string) string {
	var buf bytes.Buffer
	xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

// para builds a <w:p> with optional bold flag.
func para(text string, bold bool) string {
	rPr := ""
	if bold {
		rPr = `<w:rPr><w:b/></w:rPr>`
	}
	if text == "" {
		return `<w:p/>`
	}
	return fmt.Sprintf(
		`<w:p><w:r>%s<w:t xml:space="preserve">%s</w:t></w:r></w:p>`,
		rPr, xmlEscape(text),
	)
}

// BuildTemplateDocx returns .docx bytes containing the soal template
// dgn instruksi + 4 contoh soal (PG, essay, true_false, isian).
func BuildTemplateDocx() ([]byte, error) {
	var body strings.Builder

	// Header
	body.WriteString(para("TEMPLATE BANK SOAL — SMART-LMS", true))
	body.WriteString(para("", false))
	body.WriteString(para("CARA PAKAI:", true))
	body.WriteString(para("1. Salin / edit blok soal di bawah. Pisahkan tiap soal dgn baris '=== SOAL N ==='", false))
	body.WriteString(para("2. Field wajib: TIPE, SOAL, JAWABAN. Field opsional: TINGKAT, POIN, PEMBAHASAN.", false))
	body.WriteString(para("3. Tipe yang didukung: pilihan_ganda, essay, benar_salah, isian.", false))
	body.WriteString(para("4. Tingkat: mudah / sedang / sulit (default: sedang). Poin: angka (default: 10).", false))
	body.WriteString(para("5. Simpan file dlm format .docx, lalu upload via tombol 'Import Word' di bank soal.", false))
	body.WriteString(para("", false))
	body.WriteString(para("=== Hapus instruksi ini & mulai isi soal di bawah ===", true))
	body.WriteString(para("", false))

	// Example 1: pilihan_ganda
	body.WriteString(para("=== SOAL 1 ===", true))
	body.WriteString(para("TIPE: pilihan_ganda", false))
	body.WriteString(para("TINGKAT: mudah", false))
	body.WriteString(para("POIN: 10", false))
	body.WriteString(para("SOAL: Hasil dari 15 + 27 adalah?", false))
	body.WriteString(para("A. 32", false))
	body.WriteString(para("B. 42", false))
	body.WriteString(para("C. 52", false))
	body.WriteString(para("D. 62", false))
	body.WriteString(para("JAWABAN: B", false))
	body.WriteString(para("PEMBAHASAN: 15 + 27 = 42", false))
	body.WriteString(para("", false))

	// Example 2: essay (with keywords)
	body.WriteString(para("=== SOAL 2 ===", true))
	body.WriteString(para("TIPE: essay", false))
	body.WriteString(para("TINGKAT: sulit", false))
	body.WriteString(para("POIN: 25", false))
	body.WriteString(para("SOAL: Jelaskan proses fotosintesis pada tumbuhan!", false))
	body.WriteString(para("JAWABAN: Fotosintesis adalah proses pembuatan makanan oleh tumbuhan menggunakan cahaya matahari, air, dan karbondioksida menghasilkan glukosa dan oksigen.", false))
	body.WriteString(para("KATA_KUNCI: cahaya matahari, air, karbondioksida, glukosa, oksigen", false))
	body.WriteString(para("(Sistem hitung skor dari berapa kata kunci muncul di jawaban siswa)", false))
	body.WriteString(para("", false))

	// Example 3: benar_salah
	body.WriteString(para("=== SOAL 3 ===", true))
	body.WriteString(para("TIPE: benar_salah", false))
	body.WriteString(para("POIN: 5", false))
	body.WriteString(para("SOAL: Bumi mengelilingi matahari dalam waktu 365 hari.", false))
	body.WriteString(para("JAWABAN: BENAR", false))
	body.WriteString(para("", false))

	// Example 4: isian (fill_blank)
	body.WriteString(para("=== SOAL 4 ===", true))
	body.WriteString(para("TIPE: isian", false))
	body.WriteString(para("POIN: 10", false))
	body.WriteString(para("SOAL: Ibukota provinsi Jawa Barat adalah ____.", false))
	body.WriteString(para("JAWABAN: Bandung", false))
	body.WriteString(para("ALTERNATIF: bandung, BANDUNG, Kota Bandung", false))
	body.WriteString(para("(ALTERNATIF: jawaban lain yang juga diterima, dipisah koma)", false))
	body.WriteString(para("", false))

	// Footer tip
	body.WriteString(para("TIPS:", true))
	body.WriteString(para("• Untuk pilihan_ganda, opsi format A. / B. / C. / D. (sampai E).", false))
	body.WriteString(para("• Untuk isian, jawaban TIDAK case-sensitive. ALTERNATIF utk variasi penulisan.", false))
	body.WriteString(para("• Untuk essay, isi KATA_KUNCI sebanyak mungkin utk koreksi otomatis lebih akurat.", false))
	body.WriteString(para("• Aliases TIPE: 'pg' = pilihan_ganda, 'fb' = isian, 'ts' = benar_salah.", false))

	docXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
%s
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`, body.String())

	// Build zip
	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)

	files := []struct {
		name    string
		content string
	}{
		{"[Content_Types].xml", ctTypesXML},
		{"_rels/.rels", rootRelsXML},
		{"word/_rels/document.xml.rels", docRelsXML},
		{"word/document.xml", docXML},
	}
	for _, f := range files {
		w, err := zw.Create(f.name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write([]byte(f.content)); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return zipBuf.Bytes(), nil
}
