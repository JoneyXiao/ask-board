import type { Metadata } from 'next'
import { HostView } from '@/components/HostView'

export const metadata: Metadata = {
  title: '主持',
}

export default function HostPage() {
  return <HostView />
}
