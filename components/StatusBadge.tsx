import type { QuestionStatus } from '@/lib/types'

const LABEL: Record<QuestionStatus, string> = {
  open: '开放',
  speaking: '正在讲',
  answered: '已回答',
}

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>
}
