// Helper formatting untuk billing
export function formatRupiah(n: number | string | undefined | null): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v === null || v === undefined || isNaN(v as number)) return 'Rp 0'
  return 'Rp ' + (v as number).toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export function parseRupiah(s: string): number {
  return parseInt(s.replace(/[^\d]/g, ''), 10) || 0
}

export function formatTanggal(s: string | undefined | null): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'lunas':
      return { label: 'LUNAS', cls: 'bg-mint/15 text-mint' }
    case 'sebagian':
      return { label: 'CICILAN', cls: 'bg-amber-warm/15 text-amber-warm' }
    case 'belum_bayar':
      return { label: 'BELUM BAYAR', cls: 'bg-rose/15 text-rose' }
    case 'batal':
      return { label: 'BATAL', cls: 'bg-navy/10 text-navy/50' }
    default:
      return { label: status.toUpperCase(), cls: 'bg-navy/10 text-navy/60' }
  }
}

export function periodeOptions(): string[] {
  // 12 bulan terakhir + 6 bulan ke depan, format YYYY-MM
  const now = new Date()
  const out: string[] = []
  for (let i = -12; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
