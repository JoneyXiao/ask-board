'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const LINKS = [
  { href: '/', label: '大屏' },
  { href: '/ask', label: '提问' },
  { href: '/host', label: '主持' },
]

type SiteHeaderProps = {
  title: string
  lede?: string
  meta?: ReactNode
}

export function SiteHeader({ title, lede, meta }: SiteHeaderProps) {
  const pathname = normalizePath(usePathname() || '/')
  return (
    <header className="topbar">
      <div className="brand">
        <p className="kicker">AI Spark Meetup</p>
        <h1 className="title">{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      <div className="top-side">
        {meta}
        <nav className="nav" aria-label="页面">
          {LINKS.map((link) => {
            const active = normalizePath(link.href) === pathname
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}>
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}
