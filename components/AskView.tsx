'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ConfigNotice } from '@/components/ConfigNotice'
import { ConnectionPill } from '@/components/ConnectionPill'
import { SiteHeader } from '@/components/SiteHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { VoteButton } from '@/components/VoteButton'
import { charLength, validateSubmission } from '@/lib/validate'
import { submitQuestion, toggleVote } from '@/lib/rpc'
import { getOrCreateVoterKey, loadVotedIds, saveVotedIds } from '@/lib/storage'
import { useQuestions } from '@/lib/use-questions'
import type { Question } from '@/lib/types'

export function AskView() {
  const [reloadToken, setReloadToken] = useState(0)
  const { questions, connection, loaded, configured, freshIds, replaceQuestions } = useQuestions(reloadToken)
  const [voterKey, setVoterKey] = useState<string | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(new Set())
  const [voteError, setVoteError] = useState<string | null>(null)

  useEffect(() => {
    setVoterKey(getOrCreateVoterKey())
    setVotedIds(loadVotedIds())
  }, [])

  useEffect(() => {
    if (!formNotice) return
    const timer = window.setTimeout(() => setFormNotice(null), 2500)
    return () => window.clearTimeout(timer)
  }, [formNotice])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setFormNotice(null)
    const submission = validateSubmission(body, authorName)
    if (!submission.ok) {
      setFormError(submission.error)
      return
    }
    if (!configured) {
      setFormError('还没有配置 Supabase。')
      return
    }
    if (!voterKey) {
      setFormError('正在准备这个浏览器的标识，请再试一次。')
      return
    }
    setSubmitting(true)
    const result = await submitQuestion(submission.body, submission.authorName, voterKey)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    replaceQuestions((prev) => mergeQuestion(prev, result.data))
    setBody('')
    setFormNotice('已送到提问墙上。')
  }

  async function onVote(question: Question) {
    setVoteError(null)
    if (!voterKey || question.status === 'answered' || pendingVotes.has(question.id)) return
    setPendingVotes((prev) => addId(prev, question.id))
    const result = await toggleVote(question.id, voterKey)
    setPendingVotes((prev) => removeId(prev, question.id))
    if (!result.ok) {
      setVoteError(result.error)
      return
    }
    const nextVoted = new Set(votedIds)
    if (result.data.voted) nextVoted.add(question.id)
    else nextVoted.delete(question.id)
    setVotedIds(nextVoted)
    saveVotedIds(nextVoted)
    replaceQuestions((prev) =>
      prev.map((item) =>
        item.id === question.id ? { ...item, vote_count: result.data.vote_count } : item,
      ),
    )
  }

  const active = questions.filter((question) => question.status !== 'answered')
  const answered = questions.filter((question) => question.status === 'answered')

  return (
    <main className="screen screen-page">
      <SiteHeader
        title="提问"
        lede="写下想问的问题，也可以给已经贴出来的问题投票。"
        meta={
          configured ? (
            <ConnectionPill state={connection} onRetry={() => setReloadToken((value) => value + 1)} />
          ) : null
        }
      />

      {!configured ? <ConfigNotice /> : null}

      <form className="composer" onSubmit={onSubmit}>
        <label className="field-block">
          <span className="field-label">问题</span>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="想问讲者什么？"
            rows={4}
            maxLength={200}
            aria-describedby="body-count"
          />
          <span id="body-count" className={charLength(body.trim()) > 200 ? 'counter is-over' : 'counter'}>
            {charLength(body.trim())}/200
          </span>
        </label>
        <label className="field-block">
          <span className="field-label">昵称（可选）</span>
          <input
            name="author_name"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="怎么称呼你"
            maxLength={40}
            autoComplete="nickname"
          />
        </label>
        <div className="composer-actions">
          <button className="btn btn-gold" type="submit" disabled={submitting || !voterKey}>
            {submitting ? '提交中…' : '提交问题'}
          </button>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          {formNotice ? (
            <p className="form-success" role="status">
              {formNotice}
            </p>
          ) : null}
        </div>
      </form>

      <section className="block" aria-labelledby="vote-label">
        <div className="section-head">
          <h2 id="vote-label" className="section-label">
            可以投票
          </h2>
          <span className="count-badge">{active.length}</span>
        </div>
        {voteError ? (
          <p className="form-error" role="alert">
            {voteError}
          </p>
        ) : null}
        {active.length > 0 ? (
          <div className="stack">
            {active.map((question) => (
              <article key={question.id} className={`card ${freshIds.has(question.id) ? 'is-fresh' : ''}`}>
                <div className="card-top">
                  <StatusBadge status={question.status} />
                </div>
                <h3 className="card-body">{question.body}</h3>
                <div className="card-foot">
                  <span className="badge">{question.author_name ?? '匿名'}</span>
                  <VoteButton
                    question={question}
                    voted={votedIds.has(question.id)}
                    pending={pendingVotes.has(question.id)}
                    onVote={onVote}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">{loaded ? '还没有可以投票的问题。' : '正在同步现场提问…'}</p>
        )}
      </section>

      {answered.length > 0 ? (
        <section className="block">
          <details className="answered">
            <summary>
              <span>已回答</span>
              <span className="count-badge">{answered.length}</span>
            </summary>
            <div className="stack">
              {answered.map((question) => (
                <article key={question.id} className="card is-answered">
                  <div className="card-top">
                    <StatusBadge status={question.status} />
                  </div>
                  <h3 className="card-body">{question.body}</h3>
                  <div className="card-foot">
                    <span className="badge">{question.author_name ?? '匿名'}</span>
                    <VoteButton
                      question={question}
                      voted={votedIds.has(question.id)}
                      pending={false}
                      onVote={onVote}
                    />
                  </div>
                </article>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      <p className="footnote">
        每小时最多提交 5 个问题。投票记录保存在这台浏览器里。
      </p>
    </main>
  )
}

function mergeQuestion(list: Question[], row: Question): Question[] {
  if (list.some((item) => item.id === row.id)) {
    return list.map((item) => (item.id === row.id ? row : item))
  }
  return [...list, row]
}

function addId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids)
  next.add(id)
  return next
}

function removeId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids)
  next.delete(id)
  return next
}
