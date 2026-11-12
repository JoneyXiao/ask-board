import type { Metadata } from 'next'
import { AskView } from '@/components/AskView'

export const metadata: Metadata = {
  title: '提问',
}

export default function AskPage() {
  return <AskView />
}
