export function formatAgo(iso: string, now: number): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const delta = Math.max(0, now - then)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) return '刚刚'
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟前`
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`
  return `${Math.floor(delta / day)} 天前`
}

export function lengthTone(body: string): 'short' | 'mid' | 'long' {
  const count = Array.from(body).length
  if (count > 80) return 'long'
  if (count > 36) return 'mid'
  return 'short'
}
