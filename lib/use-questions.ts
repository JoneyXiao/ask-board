'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyQuestionChange, normalizeQuestion, sortQuestions, type ChangePayload } from './questions'
import { getSupabase, isSupabaseConfigured } from './supabase'
import type { Question } from './types'

export type ConnectionState = 'connecting' | 'live' | 'offline'

export function useQuestions(reloadToken = 0) {
  const configured = isSupabaseConfigured()
  const [questions, setQuestions] = useState<Question[]>([])
  const [connection, setConnection] = useState<ConnectionState>(configured ? 'connecting' : 'offline')
  const [loaded, setLoaded] = useState(!configured)
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set())
  const listRef = useRef<Question[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const commit = useCallback((next: Question[]) => {
    listRef.current = next
    setQuestions(next)
  }, [])

  const markFresh = useCallback((id: string) => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setFreshIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    window.requestAnimationFrame(() => {
      setFreshIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    })
    const existing = timers.current.get(id)
    if (existing) window.clearTimeout(existing)
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id)
        setFreshIds((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 1600),
    )
  }, [])

  const replaceQuestions = useCallback(
    (updater: (prev: Question[]) => Question[]) => {
      commit(updater(listRef.current))
    },
    [commit],
  )

  useEffect(() => {
    const client = getSupabase()
    if (!client) {
      setConnection('offline')
      setLoaded(true)
      return
    }

    setConnection('connecting')

    let alive = true
    let serverLoaded = false
    let highlight = false
    let pulling = false
    let generation = 0
    const buffer: ChangePayload[] = []
    const inflight: ChangePayload[] = []

    const apply = (list: Question[], payload: ChangePayload, flash: boolean) => {
      const result = applyQuestionChange(list, payload)
      if (flash && result.changedId && payload.eventType !== 'DELETE') markFresh(result.changedId)
      return result.list
    }

    const channel = client
      .channel('questions-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions' },
        (payload) => {
          const change = payload as unknown as ChangePayload
          if (!serverLoaded) {
            buffer.push(change)
            return
          }
          if (pulling) {
            inflight.push(change)
            return
          }
          if (!alive) return
          commit(apply(listRef.current, change, highlight))
        },
      )
      .subscribe((status) => {
        if (!alive) return
        if (status === 'SUBSCRIBED') setConnection('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline')
        }
      })

    const pull = async () => {
      const mine = ++generation
      pulling = true
      const { data, error } = await client.from('questions').select('*')
      if (!alive || mine !== generation) return
      if (error) {
        let list = listRef.current
        for (const change of buffer.splice(0)) list = apply(list, change, false)
        for (const change of inflight.splice(0)) list = apply(list, change, false)
        serverLoaded = true
        pulling = false
        highlight = true
        if (list !== listRef.current) commit(list)
        setConnection('offline')
        setLoaded(true)
        return
      }
      let list = (Array.isArray(data) ? data : [])
        .map((row) => normalizeQuestion(row))
        .filter((row): row is Question => row !== null)
      for (const change of buffer.splice(0)) list = apply(list, change, false)
      for (const change of inflight.splice(0)) list = apply(list, change, false)
      serverLoaded = true
      pulling = false
      highlight = true
      commit(list)
      setLoaded(true)
    }

    void pull()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      void client.removeChannel(channel)
    }
  }, [commit, markFresh, reloadToken])

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      for (const timer of activeTimers.values()) window.clearTimeout(timer)
      activeTimers.clear()
    }
  }, [])

  return {
    questions: sortQuestions(questions),
    connection,
    loaded,
    configured,
    freshIds,
    replaceQuestions,
  }
}
