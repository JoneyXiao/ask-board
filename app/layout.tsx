import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://joneyxiao.github.io/ask-board'),
  title: {
    default: '提问墙 · AI Spark Meetup',
    template: '%s · AI Spark Meetup',
  },
  description: 'AI Spark Meetup 现场提问墙。观众投稿并投票，大屏实时更新。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
