package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// ─── DOCX TEXT EXTRACTOR ──────────────────────────────────────────────
// Pure-Go extractor: unzip .docx, parse word/document.xml, walk XML
// to extract paragraphs as plain text. No external deps.

type wParagraph struct {
	XMLName xml.Name `xml:"p"`
	Runs    []wRun   `xml:"r"`
	Breaks  []wBr    `xml:"br"`
}

type wRun struct {
	XMLName xml.Name `xml:"r"`
	Text    []wText  `xml:"t"`
	Tabs    []wTab   `xml:"tab"`
	Breaks  []wBr    `xml:"br"`
}

type wText struct {
	Value string `xml:",chardata"`
}

type wTab struct{}
type wBr struct{}

// ExtractDocxText reads .docx bytes, returns plain text with paragraphs
// separated by '\n'. Tabs and inline breaks preserved.
func ExtractDocxText(data []byte) (string, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("file bukan .docx valid: %w", err)
	}

	var docXML []byte
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			docXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return "", err
			}
			break
		}
	}
	if docXML == nil {
		return "", fmt.Errorf("word/document.xml tidak ditemukan dalam .docx")
	}

	// Streaming decode — walk only <w:p> elements.
	dec := xml.NewDecoder(bytes.NewReader(docXML))
	var out strings.Builder

	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse XML gagal: %w", err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		if se.Name.Local != "p" {
			continue
		}
		var p wParagraph
		if err := dec.DecodeElement(&p, &se); err != nil {
			continue // skip malformed paragraph
		}
		// Build paragraph text
		var line strings.Builder
		for _, run := range p.Runs {
			for _, t := range run.Text {
				line.WriteString(t.Value)
			}
			for range run.Tabs {
				line.WriteString("\t")
			}
			for range run.Breaks {
				line.WriteString("\n")
			}
		}
		out.WriteString(line.String())
		out.WriteString("\n")
	}
	return out.String(), nil
}
