import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyQuestionChange, sortQuestions } from './questions'
import type { Question, QuestionStatus } from './types'

function question(partial: Partial<Question> & Pick<Question, 'id' | 'status'>): Question {
  return {
    body: partial.body ?? partial.id,
    author_name: partial.author_name ?? null,
    vote_count: partial.vote_count ?? 0,
    created_at: partial.created_at ?? '2026-11-12T00:00:00.000Z',
    ...partial,
  }
}

describe('sortQuestions', () => {
  it('puts speaking first, open by votes, and answered last', () => {
    const sorted = sortQuestions([
      question({ id: 'answered-hot', status: 'answered', vote_count: 99 }),
      question({ id: 'open-low', status: 'open', vote_count: 1 }),
      question({ id: 'speaking', status: 'speaking', vote_count: 0 }),
      question({ id: 'open-high', status: 'open', vote_count: 8 }),
    ])
    assert.deepEqual(
      sorted.map((item) => item.id),
      ['speaking', 'open-high', 'open-low', 'answered-hot'],
    )
  })

  it('breaks vote ties by newer created_at', () => {
    const sorted = sortQuestions([
      question({ id: 'older', status: 'open', vote_count: 3, created_at: '2026-11-12T01:00:00.000Z' }),
      question({ id: 'newer', status: 'open', vote_count: 3, created_at: '2026-11-12T02:00:00.000Z' }),
    ])
    assert.deepEqual(
      sorted.map((item) => item.id),
      ['newer', 'older'],
    )
  })

  it('keeps only known statuses ahead of malformed rows coerced elsewhere', () => {
    const ranks: QuestionStatus[] = ['speaking', 'open', 'answered']
    const sorted = sortQuestions(ranks.map((status, index) => question({ id: status, status, vote_count: index })))
    assert.deepEqual(
      sorted.map((item) => item.status),
      ['speaking', 'open', 'answered'],
    )
  })
})

describe('applyQuestionChange', () => {
  it('inserts, updates, and deletes by id', () => {
    const inserted = applyQuestionChange([], {
      eventType: 'INSERT',
      new: { id: 'q1', body: '你好', status: 'open', vote_count: 0, created_at: '2026-11-12T00:00:00.000Z' },
      old: {},
    })
    assert.equal(inserted.list.length, 1)
    assert.equal(inserted.changedId, 'q1')

    const updated = applyQuestionChange(inserted.list, {
      eventType: 'UPDATE',
      new: { id: 'q1', body: '你好', status: 'speaking', vote_count: 2, created_at: '2026-11-12T00:00:00.000Z' },
      old: { id: 'q1' },
    })
    assert.equal(updated.list[0]?.status, 'speaking')
    assert.equal(updated.list[0]?.vote_count, 2)

    const deleted = applyQuestionChange(updated.list, {
      eventType: 'DELETE',
      new: {},
      old: { id: 'q1' },
    })
    assert.deepEqual(deleted.list, [])
  })
})
