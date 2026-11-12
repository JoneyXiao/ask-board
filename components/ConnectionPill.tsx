import type { ConnectionState } from '@/lib/use-questions'

const LABEL: Record<ConnectionState, string> = {
  live: '实时',
  connecting: '连接中',
  offline: '未连接',
}

export function ConnectionPill({
  state,
  onRetry,
}: {
  state: ConnectionState
  onRetry?: () => void
}) {
  return (
    <div className="pill-row">
      <p className={`pill pill-${state}`}>
        <span className="dot" aria-hidden="true" />
        {LABEL[state]}
      </p>
      {state === 'offline' && onRetry ? (
        <button type="button" className="btn btn-ghost btn-small" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  )
}
