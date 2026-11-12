export function toUserMessage(message: string | undefined): string {
  const text = (message ?? '').toLowerCase()
  if (
    text.length === 0 ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('fetch failed')
  ) {
    return '连不上 Supabase。请确认本地已经 supabase start，并且地址从浏览器能访问。'
  }
  if (text.includes('rate limit')) return '每小时最多提交 5 个问题，稍后再试。'
  if (text.includes('body must be')) return '问题需要 1 到 200 个字。'
  if (text.includes('author_name')) return '昵称最多 40 个字。'
  if (text.includes('invalid voter_key')) return '浏览器标识无效，请刷新页面后再试。'
  if (text.includes('cannot vote') || text.includes('answered')) return '已回答的问题不能投票。'
  if (text.includes('question not found')) return '找不到这个问题。'
  if (text.includes('invalid pin')) return 'PIN 不正确。'
  if (text.includes('invalid or expired session')) {
    return '主持会话已失效，请重新验证 PIN。'
  }
  if (text.includes('invalid status')) return '状态无效。'
  return '操作没有成功，请重试。'
}

export function isSessionError(message: string | undefined): boolean {
  const text = (message ?? '').toLowerCase()
  return text.includes('invalid or expired session') || text.includes('expired session')
}
