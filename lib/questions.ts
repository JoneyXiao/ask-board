import type { Question, QuestionStatus } from './types'

const STATUS_RANK: Record<QuestionStatus, number> = {
  speaking: 0,
  open: 1,
  answered: 2,
}

const STATUSES = new Set<QuestionStatus>(['open', 'speaking', 'answered'])

export type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export function normalizeQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || row.id.length === 0) return null
  const status = typeof row.status === 'string' && STATUSES.has(row.status as QuestionStatus)
    ? (row.status as QuestionStatus)
    : 'open'
  const author = row.author_name
  const voteCount = typeof row.vote_count === 'number' ? row.vote_count : Number(row.vote_count ?? 0)
  return {
    id: row.id,
    body: typeof row.body === 'string' ? row.body : '',
    author_name: typeof author === 'string' && author.trim().length > 0 ? author : null,
    status,
    vote_count: Number.isFinite(voteCount) ? voteCount : 0,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  }
}

export function sortQuestions(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (byStatus !== 0) return byStatus
    if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count
    const byTime = timeValue(b.created_at) - timeValue(a.created_at)
    if (byTime !== 0) return byTime
    if (a.id === b.id) return 0
    return a.id < b.id ? -1 : 1
  })
}

export function applyQuestionChange(
  list: Question[],
  payload: ChangePayload,
): { list: Question[]; changedId?: string } {
  if (payload.eventType === 'DELETE') {
    const id = typeof payload.old?.id === 'string' ? payload.old.id : ''
    if (!id) return { list }
    return { list: list.filter((question) => question.id !== id), changedId: id }
  }
  const row = normalizeQuestion(payload.new)
  if (!row) return { list }
  const index = list.findIndex((question) => question.id === row.id)
  if (index === -1) return { list: [...list, row], changedId: row.id }
  const next = list.slice()
  next[index] = row
  return { list: next, changedId: row.id }
}

function timeValue(value: string): number {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}
