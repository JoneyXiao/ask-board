'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export function WallRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <main className="screen screen-page">
      <p className="kicker">AI Spark Meetup</p>
      <h1 className="title">正在打开大屏…</h1>
      <p className="lede">如果没有自动跳转，用下面的链接。</p>
      <Link className="btn btn-gold" href="/">
        打开提问墙
      </Link>
    </main>
  )
}
