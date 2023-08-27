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
  effect?: "Above Threshold (No Effect)" | "Below Threshold (Contributed to Passing)"
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

export interface QuestionResult extends Question {
  totalVotes?: number
  passedRound?: number
  passedTime?: number
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

export interface SessionResults extends SessionData {
  questionResults: QuestionResult[]
}

export interface VotingData {
  results: SessionResults
  voters: VoterInfo[]
  votes: VoteRecord[]
}
