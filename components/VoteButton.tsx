'use client'

import type { Question } from '@/lib/types'

export function VoteButton({
  question,
  voted,
  pending,
  onVote,
}: {
  question: Question
  voted: boolean
  pending: boolean
  onVote: (question: Question) => void
}) {
  const answered = question.status === 'answered'
  const label = answered ? '已回答' : voted ? '已投票' : '投票'
  const aria = answered
    ? `已回答，不能投票：${question.body}，${question.vote_count} 票`
    : voted
      ? `已投票，再点一次取消：${question.body}，${question.vote_count} 票`
      : `投票：${question.body}，当前 ${question.vote_count} 票`

  return (
    <button
      type="button"
      className={voted && !answered ? 'btn btn-gold vote-btn' : 'btn btn-ghost vote-btn'}
      aria-pressed={voted}
      aria-label={aria}
      disabled={answered || pending}
      onClick={() => onVote(question)}
    >
      <span className="vote-count">{question.vote_count}</span>
      <span>{pending ? '提交中' : label}</span>
    </button>
  )
}
