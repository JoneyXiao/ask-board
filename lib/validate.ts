export function charLength(value: string): number {
  return Array.from(value).length
}

export type Submission =
  | { ok: true; body: string; authorName: string | null }
  | { ok: false; error: string }

export function validateSubmission(body: string, authorName: string): Submission {
  const trimmed = body.trim()
  const author = authorName.trim()
  if (charLength(trimmed) < 1) return { ok: false, error: '请写下问题。' }
  if (charLength(trimmed) > 200) return { ok: false, error: '问题最多 200 个字。' }
  if (charLength(author) > 40) return { ok: false, error: '昵称最多 40 个字。' }
  return { ok: true, body: trimmed, authorName: author ? author : null }
}
