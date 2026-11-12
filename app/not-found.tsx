import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="screen screen-page">
      <p className="kicker">AI Spark Meetup</p>
      <h1 className="title">没有这一页</h1>
      <p className="lede">提问墙、投稿和主持都在这几个入口里。</p>
      <Link className="btn btn-gold" href="/">
        回提问墙
      </Link>
    </main>
  )
}
