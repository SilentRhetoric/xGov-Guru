export type VoterInfo = {
  address: string
  voteWeights: bigint[]
  voterWeight: number
  relativeWeight: number
  voteRound: number
  voteRoundTime: number
}

export type VoteRecord = {
  address: string
  proposal: string
  proposalIndex: number
  votes: number
  voterWeight: number
  voteRound: number
  voteRoundTime: number
  effect?: "No Effect - Above Threshold" | "Contributed To Passing - Below Threshold"
}

export type Created = {
  at: string
  by: string
}

export type Metadata = {
  ask: number
  category: string
  focus_area: string
  link: string
  threshold: number
}

export type Options = {
  id: string
  label: string
}

export interface Question {
  description: string
  id: string
  metadata: Metadata
  options: Options[]
  // proposal_url: string
  prompt: string
}

export interface SessionData {
  created: Created
  description: string
  end: string
  id: string
  informationUrl: string
  questions: Question[]
  start: string
  title: string
  type: number
  voteGatingSnapshotCid: string
}

export interface QuestionResult extends Question {
  totalVotes?: number
  numVoters?: number
  passedRound?: number
  passedTime?: number
  proposalIndex?: number
  proposal?: string
  threshold?: number
  passed?: boolean
}

export interface SessionResults extends SessionData {
  questionResults: QuestionResult[]
}

export interface VotingData {
  results: SessionResults
  voters: VoterInfo[]
  votes: VoteRecord[]
}
