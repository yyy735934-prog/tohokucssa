export function formatTime(ts) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('zh-CN')
}
