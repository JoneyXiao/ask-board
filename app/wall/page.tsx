import type { Metadata } from 'next'
import { WallRedirect } from '@/components/WallRedirect'

export const metadata: Metadata = {
  title: '提问墙',
}

export default function WallAliasPage() {
  return <WallRedirect />
}
