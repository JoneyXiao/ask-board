import { isSessionError, toUserMessage } from './errors'
import { getSupabase } from './supabase'
import type { HostSession, Question, VoteResult } from './types'
import { normalizeQuestion } from './questions'

type RpcFailure = { ok: false; error: string; sessionExpired: boolean }
type RpcSuccess<T> = { ok: true; data: T }

export async function submitQuestion(
  body: string,
  authorName: string | null,
  voterKey: string,
): Promise<RpcSuccess<Question> | RpcFailure> {
  const result = await callRpc('submit_question', {
    body,
    author_name: authorName,
    voter_key: voterKey,
  })
  if (!result.ok) return result
  const row = normalizeQuestion(unwrapOne(result.data))
  if (!row) return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  return { ok: true, data: row }
}

export async function toggleVote(
  questionId: string,
  voterKey: string,
): Promise<RpcSuccess<VoteResult> | RpcFailure> {
  const result = await callRpc('toggle_vote', {
    question_id: questionId,
    voter_key: voterKey,
  })
  if (!result.ok) return result
  const row = unwrapOne(result.data)
  if (!row || typeof row !== 'object') {
    return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  }
  const record = row as Record<string, unknown>
  const voteCount = Number(record.vote_count)
  if (!Number.isFinite(voteCount) || typeof record.voted !== 'boolean') {
    return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  }
  return { ok: true, data: { vote_count: voteCount, voted: record.voted } }
}

export async function verifyHostPin(
  pin: string,
): Promise<RpcSuccess<HostSession> | RpcFailure> {
  const result = await callRpc('verify_host_pin', { pin })
  if (!result.ok) return result
  const row = unwrapOne(result.data)
  if (!row || typeof row !== 'object') {
    return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  }
  const record = row as Record<string, unknown>
  if (typeof record.token !== 'string' || record.token.length === 0) {
    return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  }
  return {
    ok: true,
    data: {
      token: record.token,
      expires_at: typeof record.expires_at === 'string' ? record.expires_at : '',
    },
  }
}

export async function setQuestionStatus(
  questionId: string,
  status: Question['status'],
  sessionToken: string,
): Promise<RpcSuccess<Question> | RpcFailure> {
  const result = await callRpc('set_question_status', {
    question_id: questionId,
    status,
    session_token: sessionToken,
  })
  if (!result.ok) return result
  const row = normalizeQuestion(unwrapOne(result.data))
  if (!row) return { ok: false, error: '操作没有成功，请重试。', sessionExpired: false }
  return { ok: true, data: row }
}

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcSuccess<unknown> | RpcFailure> {
  const client = getSupabase()
  if (!client) {
    return { ok: false, error: '还没有配置 Supabase。', sessionExpired: false }
  }
  const { data, error } = await client.rpc(fn, args)
  if (error) {
    return {
      ok: false,
      error: toUserMessage(error.message),
      sessionExpired: isSessionError(error.message),
    }
  }
  return { ok: true, data }
}

function unwrapOne(data: unknown): unknown {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}
