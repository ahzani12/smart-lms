// Package imageproc — utilitas pemrosesan gambar (auto-transparent BG, dll)
package imageproc

import (
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg" // register jpeg decoder
	"image/png"
	_ "image/png" // register png decoder
	"os"
)

// MakeTransparent membaca gambar di srcPath, menghapus background putih
// (atau mendekati putih), dan menulis hasilnya sebagai PNG transparan ke dstPath.
//
// threshold: ambang brightness 0-255. Pixel dengan rata-rata RGB >= threshold
// dianggap "putih" → alpha 0. Default rekomendasi: 230 untuk scan TTD/stempel.
//
// feather: lebar gradien transisi di edge (semi-transparan), biasanya 30-40.
// Bikin pinggiran TTD/stempel ngga sharp/jagged.
func MakeTransparent(srcPath, dstPath string, threshold, feather uint8) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("open src: %w", err)
	}
	defer src.Close()

	img, _, err := image.Decode(src)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	b := img.Bounds()
	out := image.NewRGBA(b)

	thr := int(threshold)
	feat := int(feather)
	if feat < 1 {
		feat = 1
	}

	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r16, g16, b16, a16 := img.At(x, y).RGBA()
			r := uint8(r16 >> 8)
			g := uint8(g16 >> 8)
			bl := uint8(b16 >> 8)
			a := uint8(a16 >> 8)

			// Pixel yang udah mostly-transparan, biarin (input PNG dengan alpha)
			if a < 16 {
				out.Set(x, y, color.RGBA{0, 0, 0, 0})
				continue
			}

			brightness := (int(r) + int(g) + int(bl)) / 3

			switch {
			case brightness >= thr:
				// Cukup putih → fully transparent
				out.Set(x, y, color.RGBA{0, 0, 0, 0})
			case brightness >= thr-feat:
				// Zona gradient: alpha proporsional ke jarak dari threshold
				dist := thr - brightness // 0..feat
				alpha := uint8(255 * dist / feat)
				out.Set(x, y, color.RGBA{r, g, bl, alpha})
			default:
				// Cukup gelap → opaque, pakai original alpha (bisa < 255)
				out.Set(x, y, color.RGBA{r, g, bl, a})
			}
		}
	}

	dst, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("create dst: %w", err)
	}
	defer dst.Close()

	if err := png.Encode(dst, out); err != nil {
		return fmt.Errorf("encode png: %w", err)
	}
	return nil
}
