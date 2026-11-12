import type { Metadata } from 'next'
import { WallView } from '@/components/WallView'

export const metadata: Metadata = {
  title: '提问墙',
}

export default function HomePage() {
  return <WallView />
}
