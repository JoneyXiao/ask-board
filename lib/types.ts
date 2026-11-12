export type QuestionStatus = 'open' | 'speaking' | 'answered'

export type Question = {
  id: string
  body: string
  author_name: string | null
  status: QuestionStatus
  vote_count: number
  created_at: string
}

export type VoteResult = {
  vote_count: number
  voted: boolean
}

export type HostSession = {
  token: string
  expires_at: string
}
