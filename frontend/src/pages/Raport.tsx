import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { FileText, Eye, X, Download } from 'lucide-react'

export default function Raport() {
  const [raports, setRaports] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [classFilter, setClassFilter] = useState(0)
  const [semesterFilter, setSemesterFilter] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    axios.get('/api/classes').then(r => setClasses(r.data?.classes || r.data || []))
    axios.get('/api/semesters').then(r => setSemesters(r.data || []))
  }, [])

  const fetchRaports = () => {
    setLoading(true)
    const params: any = {}
    if (classFilter > 0) params.class_id = classFilter
    if (semesterFilter > 0) params.semester_id = semesterFilter
    axios.get('/api/raport', { params }).then(r => {
      setRaports(r.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchRaports() }, [classFilter, semesterFilter])

  const viewDetail = async (id: number) => {
    try {
      const res = await axios.get(`/api/raport/${id}`)
      setDetail(res.data)
      setShowDetail(true)
    } catch {
      toast.error('Gagal memuat detail raport')
    }
  }

  const downloadAllRaport = async () => {
    if (!classFilter || !semesterFilter) return
    try {
      toast.loading('Generating PDF...', { id: 'download-raport' })
      const res = await axios.get('/api/raport/download-class', {
        params: { class_id: classFilter, semester_id: semesterFilter },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'raport.zip'
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Download berhasil!', { id: 'download-raport' })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal download raport', { id: 'download-raport' })
    }
  }

  const printRaport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow || !detail) return

    const { raport, school, attendance } = detail
    const items = raport.items || []
    const avgScore = items.length > 0 ? (items.reduce((sum: number, i: any) => sum + i.score, 0) / items.length).toFixed(1) : '0'

    printWindow.document.write(`
      <html><head><title>Raport ${raport.student?.user?.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; padding: 30px 40px; font-size: 11pt; color: #000; }
        @page { size: A4; margin: 15mm 20mm; }

        .kop { display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 5px; }
        .kop-logo { width: 70px; height: 70px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; margin-right: 15px; flex-shrink: 0; }
        .kop-logo img { width: 100%; height: 100%; object-fit: contain; }
        .kop-text { text-align: center; flex: 1; }
        .kop-text .instansi { font-size: 10pt; letter-spacing: 1px; }
        .kop-text .sekolah { font-size: 16pt; font-weight: bold; letter-spacing: 2px; }
        .kop-text .alamat { font-size: 9pt; margin-top: 2px; }
        .kop-text .kontak { font-size: 9pt; }
        .kop-line2 { border-top: 1px solid #000; margin-top: 2px; }

        .judul { text-align: center; margin: 20px 0 15px; }
        .judul h2 { font-size: 14pt; text-decoration: underline; letter-spacing: 1px; }
        .judul p { font-size: 10pt; margin-top: 3px; }

        .data-siswa { margin-bottom: 15px; }
        .data-siswa table { width: 100%; }
        .data-siswa td { padding: 2px 0; vertical-align: top; }
        .data-siswa .label { width: 130px; }
        .data-siswa .sep { width: 15px; }
        .data-siswa .val { }

        table.nilai { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        table.nilai th, table.nilai td { border: 1px solid #000; padding: 5px 8px; }
        table.nilai th { background: #f5f5f5; font-weight: bold; text-align: center; font-size: 10pt; }
        table.nilai td.c { text-align: center; }
        table.nilai td.no { width: 35px; text-align: center; }
        table.nilai tfoot td { font-weight: bold; }

        .section-title { font-weight: bold; margin: 15px 0 8px; font-size: 11pt; }

        table.kehadiran { border-collapse: collapse; margin-bottom: 15px; }
        table.kehadiran td { border: 1px solid #000; padding: 4px 12px; }
        table.kehadiran td.label { width: 150px; }
        table.kehadiran td.val { width: 60px; text-align: center; }

        .catatan { border: 1px solid #000; padding: 10px; min-height: 50px; margin-bottom: 20px; font-style: italic; }

        .ttd { margin-top: 30px; }
        .ttd table { width: 100%; }
        .ttd td { text-align: center; vertical-align: top; padding: 5px; }
        .ttd .nama { margin-top: 60px; font-weight: bold; text-decoration: underline; }
        .ttd .jabatan { font-size: 10pt; }

        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style></head><body>

      <!-- KOP SEKOLAH -->
      <div class="kop">
        <div class="kop-logo">
          ${school?.header_logo ? `<img src="${window.location.origin}${school.header_logo}" />` : 'LOGO'}
        </div>
        <div class="kop-text">
          <div class="instansi">${school?.header_text?.replace(/\\n/g, '<br>') || 'PEMERINTAH DAERAH<br>DINAS PENDIDIKAN'}</div>
          <div class="sekolah">${school?.name || 'NAMA SEKOLAH'}</div>
          <div class="alamat">${school?.address || 'Alamat Sekolah'}</div>
          <div class="kontak">${school?.phone ? 'Telp. ' + school.phone : ''} ${school?.email ? '| Email: ' + school.email : ''} ${school?.website ? '| ' + school.website : ''}</div>
        </div>
      </div>
      <div class="kop-line2"></div>

      <!-- JUDUL -->
      <div class="judul">
        <h2>LAPORAN HASIL BELAJAR PESERTA DIDIK</h2>
        <p>Tahun Pelajaran ${raport.semester?.year || '-'} — Semester ${raport.semester?.period === 'ganjil' ? 'Ganjil (I)' : 'Genap (II)'}</p>
      </div>

      <!-- DATA SISWA -->
      <div class="data-siswa">
        <table>
          <tr>
            <td class="label">Nama Peserta Didik</td><td class="sep">:</td><td class="val"><strong>${raport.student?.user?.name || '-'}</strong></td>
            <td class="label" style="padding-left:30px">Kelas</td><td class="sep">:</td><td class="val">${raport.student?.class?.name || '-'}</td>
          </tr>
          <tr>
            <td class="label">NIS / NISN</td><td class="sep">:</td><td class="val">${raport.student?.nis || '-'} / ${raport.student?.nisn || '-'}</td>
            <td class="label" style="padding-left:30px">Semester</td><td class="sep">:</td><td class="val">${raport.semester?.name || '-'}</td>
          </tr>
          <tr>
            <td class="label">NPSN Sekolah</td><td class="sep">:</td><td class="val">${school?.npsn || '-'}</td>
            <td class="label" style="padding-left:30px">Peringkat</td><td class="sep">:</td><td class="val"><strong>${raport.rank || '-'}</strong> dari ${raports.length || '-'} siswa</td>
          </tr>
        </table>
      </div>

      <!-- TABEL NILAI -->
      <div class="section-title">A. Nilai Akademik</div>
      <table class="nilai">
        <thead>
          <tr>
            <th>No</th>
            <th>Mata Pelajaran</th>
            <th>KKM</th>
            <th>Nilai</th>
            <th>Predikat</th>
            <th>Guru Pengampu</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item: any, i: number) => `
            <tr>
              <td class="no">${i + 1}</td>
              <td>${item.subject?.name || '-'}</td>
              <td class="c">75</td>
              <td class="c"><strong>${item.score}</strong></td>
              <td class="c">${item.grade}</td>
              <td>${item.teacher?.user?.name || '-'}</td>
            </tr>
          `).join('')}
          ${items.length === 0 ? '<tr><td colspan="6" class="c" style="padding:15px;color:#999;">Belum ada data nilai</td></tr>' : ''}
        </tbody>
        ${items.length > 0 ? `
        <tfoot>
          <tr>
            <td colspan="3" class="c">Rata-rata</td>
            <td class="c">${avgScore}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>` : ''}
      </table>

      <!-- KEHADIRAN -->
      <div class="section-title">B. Ketidakhadiran</div>
      <table class="kehadiran">
        <tr><td class="label">Sakit</td><td class="val">${attendance?.sakit || 0}</td><td>hari</td></tr>
        <tr><td class="label">Izin</td><td class="val">${attendance?.izin || 0}</td><td>hari</td></tr>
        <tr><td class="label">Tanpa Keterangan (Alfa)</td><td class="val">${attendance?.alfa || 0}</td><td>hari</td></tr>
        <tr><td class="label">Terlambat</td><td class="val">${attendance?.terlambat || 0}</td><td>hari</td></tr>
      </table>

      <!-- CATATAN -->
      <div class="section-title">C. Catatan Wali Kelas</div>
      <div class="catatan">${raport.notes || 'Terus tingkatkan prestasi belajar.'}</div>

      <!-- TANDA TANGAN -->
      <div class="ttd">
        <table>
          <tr>
            <td>
              <div>Mengetahui,</div>
              <div class="jabatan">Orang Tua / Wali</div>
              <div class="nama">........................</div>
            </td>
            <td>
              <div>&nbsp;</div>
              <div class="jabatan">Wali Kelas</div>
              <div class="nama">........................</div>
            </td>
            <td>
              <div>&nbsp;</div>
              <div class="jabatan">Kepala Sekolah</div>
              <div class="nama">........................</div>
              <div style="font-size:9pt">NIP. ........................</div>
            </td>
          </tr>
        </table>
      </div>

      </body></html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
          <FileText className="w-6 h-6 text-amber-warm" />
          Raport Siswa
        </h1>
        <p className="text-navy/60">Lihat dan cetak raport hasil belajar</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={semesterFilter} onChange={e => setSemesterFilter(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border text-sm">
          <option value={0}>Semua Semester</option>
          {semesters.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classFilter} onChange={e => setClassFilter(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border text-sm">
          <option value={0}>Semua Kelas</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classFilter > 0 && semesterFilter > 0 && (
          <button onClick={downloadAllRaport}
            className="flex items-center gap-2 px-4 py-2.5 bg-mint text-white rounded-2xl text-sm font-bold hover:opacity-90 shadow-card transition">
            <Download className="w-4 h-4" strokeWidth={2.5} /> Download Semua (ZIP)
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-warm border-t-amber-warm rounded-full"></div></div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-soft border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-navy/70">Siswa</th>
                <th className="text-left px-4 py-3 font-medium text-navy/70">NIS</th>
                <th className="text-left px-4 py-3 font-medium text-navy/70">Kelas</th>
                <th className="text-left px-4 py-3 font-medium text-navy/70">Semester</th>
                <th className="text-center px-4 py-3 font-medium text-navy/70">Peringkat</th>
                <th className="text-center px-4 py-3 font-medium text-navy/70">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {raports.map((r: any) => (
                <tr key={r.id} className="hover:bg-cream-soft">
                  <td className="px-4 py-3 font-medium">{r.student?.user?.name || '-'}</td>
                  <td className="px-4 py-3 text-navy/70">{r.student?.nis || '-'}</td>
                  <td className="px-4 py-3 text-navy/70">{r.student?.class?.name || '-'}</td>
                  <td className="px-4 py-3 text-navy/70">{r.semester?.name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.rank ? <span className="px-2 py-0.5 bg-amber-warm/15 text-amber-warm rounded-full text-xs font-bold">#{r.rank}</span> : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => viewDetail(r.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-soft/40 text-amber-warm rounded-lg hover:bg-amber-soft">
                      <Eye className="w-3.5 h-3.5" /> Lihat
                    </button>
                  </td>
                </tr>
              ))}
              {raports.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-navy/40">Belum ada raport. Generate dulu di menu Generate Raport.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Detail Raport</h2>
              <div className="flex gap-2">
                <button onClick={printRaport}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Download className="w-4 h-4" /> Cetak
                </button>
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-amber-soft/40 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-navy/60">Nama:</span> <span className="font-medium">{detail.raport?.student?.user?.name}</span></div>
                <div><span className="text-navy/60">Kelas:</span> <span className="font-medium">{detail.raport?.student?.class?.name}</span></div>
                <div><span className="text-navy/60">NIS:</span> <span className="font-medium">{detail.raport?.student?.nis}</span></div>
                <div><span className="text-navy/60">Semester:</span> <span className="font-medium">{detail.raport?.semester?.name}</span></div>
                <div><span className="text-navy/60">Peringkat:</span> <span className="font-bold text-amber-warm">#{detail.raport?.rank || '-'}</span></div>
              </div>

              {/* Scores Table */}
              <div>
                <h3 className="font-semibold text-navy mb-3">Nilai Per Mata Pelajaran</h3>
                <table className="w-full text-sm border">
                  <thead className="bg-cream-soft">
                    <tr>
                      <th className="px-4 py-2 text-left border">No</th>
                      <th className="px-4 py-2 text-left border">Mata Pelajaran</th>
                      <th className="px-4 py-2 text-center border">Nilai</th>
                      <th className="px-4 py-2 text-center border">Grade</th>
                      <th className="px-4 py-2 text-left border">Guru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.raport?.items || []).map((item: any, i: number) => (
                      <tr key={item.id} className="hover:bg-cream-soft">
                        <td className="px-4 py-2 border text-center">{i + 1}</td>
                        <td className="px-4 py-2 border">{item.subject?.name || '-'}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{item.score}</td>
                        <td className="px-4 py-2 border text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.grade === 'A' ? 'bg-mint/15 text-mint' :
                            item.grade === 'B' ? 'bg-sky-warm/15 text-sky-warm' :
                            item.grade === 'C' ? 'bg-amber-warm/15 text-amber-warm' :
                            'bg-rose/15 text-rose'
                          }`}>{item.grade}</span>
                        </td>
                        <td className="px-4 py-2 border">{item.teacher?.user?.name || '-'}</td>
                      </tr>
                    ))}
                    {(!detail.raport?.items || detail.raport.items.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-4 text-center text-navy/40 border">Belum ada data nilai</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Attendance */}
              <div>
                <h3 className="font-semibold text-navy mb-3">Kehadiran</h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Hadir', value: detail.attendance?.hadir, color: 'green' },
                    { label: 'Sakit', value: detail.attendance?.sakit, color: 'blue' },
                    { label: 'Izin', value: detail.attendance?.izin, color: 'yellow' },
                    { label: 'Alfa', value: detail.attendance?.alfa, color: 'red' },
                    { label: 'Terlambat', value: detail.attendance?.terlambat, color: 'orange' },
                  ].map(a => (
                    <div key={a.label} className={`text-center p-3 rounded-xl bg-${a.color}-50`}>
                      <div className={`text-2xl font-bold text-${a.color}-600`}>{a.value || 0}</div>
                      <div className="text-xs text-navy/70">{a.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {detail.raport?.notes && (
                <div>
                  <h3 className="font-semibold text-navy mb-2">Catatan</h3>
                  <p className="text-sm text-navy/70 bg-cream-soft rounded-xl p-4">{detail.raport.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
