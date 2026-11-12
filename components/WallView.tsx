'use client'

import { useState } from 'react'
import { ConfigNotice } from '@/components/ConfigNotice'
import { ConnectionPill } from '@/components/ConnectionPill'
import { SiteHeader } from '@/components/SiteHeader'
import { formatAgo, lengthTone } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { useQuestions } from '@/lib/use-questions'
import type { Question } from '@/lib/types'

export function WallView() {
  const [reloadToken, setReloadToken] = useState(0)
  const { questions, connection, loaded, configured, freshIds } = useQuestions(reloadToken)
  const now = useNow()
  const speaking = questions.filter((question) => question.status === 'speaking')
  const hero = speaking[0]
  const open = [
    ...speaking.slice(1),
    ...questions.filter((question) => question.status === 'open'),
  ]
  const answered = questions.filter((question) => question.status === 'answered')

  return (
    <main className="screen screen-wall">
      <SiteHeader
        title="提问墙"
        meta={
          <>
            {configured ? (
              <ConnectionPill state={connection} onRetry={() => setReloadToken((value) => value + 1)} />
            ) : null}
            <p className="count">
              <span>{questions.length}</span>
              个问题
            </p>
          </>
        }
      />

      {!configured ? <ConfigNotice /> : null}

      <section className="block" aria-labelledby="speaking-label">
        <h2 id="speaking-label" className="section-label section-label-gold">
          正在讲
        </h2>
        {hero ? (
          <article className={`hero is-${lengthTone(hero.body)} ${freshIds.has(hero.id) ? 'is-fresh' : ''}`}>
            <h3 className="hero-body">{hero.body}</h3>
            <QuestionFacts question={hero} now={now} prominent />
          </article>
        ) : (
          <p className="empty hero-empty">{loaded ? '现在没有正在讲的问题。' : '正在同步现场提问…'}</p>
        )}
      </section>

      <section className="block" aria-labelledby="open-label">
        <div className="section-head">
          <h2 id="open-label" className="section-label">
            开放中
          </h2>
          <span className="count-badge">{open.length}</span>
        </div>
        {open.length > 0 ? (
          <div className="grid">
            {open.map((question) => (
              <article
                key={question.id}
                className={`card ${question.status === 'speaking' ? 'is-speaking' : ''} ${freshIds.has(question.id) ? 'is-fresh' : ''}`}
              >
                <h3 className="card-body">{question.body}</h3>
                <QuestionFacts question={question} now={now} />
              </article>
            ))}
          </div>
        ) : loaded ? (
          <p className="empty">没有开放中的问题。</p>
        ) : null}
      </section>

      {answered.length > 0 ? (
        <section className="block" aria-labelledby="answered-label">
          <details className="answered">
            <summary>
              <span id="answered-label">已回答</span>
              <span className="count-badge">{answered.length}</span>
            </summary>
            <ul className="answered-list">
              {answered.map((question) => (
                <li key={question.id}>
                  <p>{question.body}</p>
                  <QuestionFacts question={question} now={now} compact />
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </main>
  )
}

function QuestionFacts({
  question,
  now,
  prominent = false,
  compact = false,
}: {
  question: Question
  now: number | null
  prominent?: boolean
  compact?: boolean
}) {
  const ago = now === null ? '' : formatAgo(question.created_at, now)
  return (
    <div className={prominent ? 'meta-row meta-row-lg' : 'meta-row'}>
      <p className={compact ? 'votes votes-compact' : 'votes'}>
        <span>{question.vote_count}</span>
        <small>票</small>
      </p>
      <span className="badge">{question.author_name ?? '匿名'}</span>
      {ago ? <span className="badge badge-muted">{ago}</span> : null}
    </div>
  )
}
