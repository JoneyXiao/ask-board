'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ConfigNotice } from '@/components/ConfigNotice'
import { ConnectionPill } from '@/components/ConnectionPill'
import { SiteHeader } from '@/components/SiteHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { setQuestionStatus, verifyHostPin } from '@/lib/rpc'
import { clearHostSession, loadHostSession, saveHostSession } from '@/lib/storage'
import { useQuestions } from '@/lib/use-questions'
import type { Question, QuestionStatus } from '@/lib/types'

const STATUSES: QuestionStatus[] = ['open', 'speaking', 'answered']
const STATUS_LABEL: Record<QuestionStatus, string> = {
  open: '开放',
  speaking: '正在讲',
  answered: '已回答',
}

export function HostView() {
  const [reloadToken, setReloadToken] = useState(0)
  const { questions, connection, loaded, configured, freshIds, replaceQuestions } = useQuestions(reloadToken)
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const session = loadHostSession()
    if (session) {
      setToken(session.token)
      setReady(true)
    }
    setChecked(true)
  }, [])

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPinError(null)
    const value = pin.trim()
    if (!value) {
      setPinError('请输入 PIN。')
      return
    }
    if (!configured) {
      setPinError('还没有配置 Supabase。')
      return
    }
    setVerifying(true)
    const result = await verifyHostPin(value)
    setVerifying(false)
    setPin('')
    if (!result.ok) {
      setPinError(result.error)
      return
    }
    saveHostSession(result.data.token, result.data.expires_at)
    setToken(result.data.token)
    setReady(true)
  }

  function signOut() {
    clearHostSession()
    setToken(null)
    setReady(false)
    setStatusError(null)
  }

  async function changeStatus(question: Question, status: QuestionStatus) {
    if (!token || pendingId || question.status === status) return
    setStatusError(null)
    setPendingId(question.id)
    const result = await setQuestionStatus(question.id, status, token)
    setPendingId(null)
    if (!result.ok) {
      if (result.sessionExpired) {
        clearHostSession()
        setToken(null)
        setReady(false)
        setPinError(result.error)
        return
      }
      setStatusError(result.error)
      return
    }
    replaceQuestions((prev) =>
      prev.map((item) => {
        if (status === 'speaking' && item.status === 'speaking' && item.id !== question.id) {
          return { ...item, status: 'open' }
        }
        if (item.id === result.data.id) return result.data
        return item
      }),
    )
  }

  return (
    <main className="screen screen-page">
      <SiteHeader
        title="主持"
        lede="验证 PIN 后，把问题标成开放、正在讲或已回答。"
        meta={
          configured ? (
            <ConnectionPill state={connection} onRetry={() => setReloadToken((value) => value + 1)} />
          ) : null
        }
      />

      {!configured ? <ConfigNotice /> : null}

      {!checked ? <p className="empty">正在确认会话…</p> : null}

      {checked && !ready ? (
        <form className="composer composer-pin" onSubmit={onVerify}>
          <label className="field-block">
            <span className="field-label">主持 PIN</span>
            <input
              name="host-pin"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </label>
          <p className="hint">会话只留在这个标签页里，关闭后需要重新验证。</p>
          <div className="composer-actions">
            <button className="btn btn-gold" type="submit" disabled={verifying}>
              {verifying ? '验证中…' : '验证'}
            </button>
            {pinError ? (
              <p className="form-error" role="alert">
                {pinError}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      {checked && ready ? (
        <section className="block">
          <div className="host-bar">
            <p className="hint">这个标签页已通过验证。同一时间只会有一条正在讲。</p>
            <button type="button" className="btn btn-ghost btn-small" onClick={signOut}>
              退出
            </button>
          </div>
          {statusError ? (
            <p className="form-error" role="alert">
              {statusError}
            </p>
          ) : null}
          {questions.length > 0 ? (
            <div className="stack">
              {questions.map((question) => {
                const pending = pendingId !== null
                return (
                  <article
                    key={question.id}
                    className={`card ${question.status === 'speaking' ? 'is-speaking' : ''} ${freshIds.has(question.id) ? 'is-fresh' : ''}`}
                  >
                    <div className="card-top">
                      <StatusBadge status={question.status} />
                      <span className="votes votes-compact">
                        <span>{question.vote_count}</span>
                        <small>票</small>
                      </span>
                    </div>
                    <h3 className="card-body">{question.body}</h3>
                    <p className="hint">{question.author_name ?? '匿名'}</p>
                    <div className="segment" role="group" aria-label={`设置「${question.body}」的状态`}>
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={question.status === status}
                          disabled={pending || question.status === status}
                          onClick={() => changeStatus(question, status)}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="empty">{loaded ? '还没有提问。观众提交之后会出现在这里。' : '正在同步现场提问…'}</p>
          )}
        </section>
      ) : null}
    </main>
  )
}
