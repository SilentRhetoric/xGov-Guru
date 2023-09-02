export type Governor = {
  address: string
  signature: string
  weight: number
}

export type GovernorsData = {
  title: string
  publicKey: string
  snapshot: Governor[]
  created: { at: string; by: string }
}

export type VoterInfo = {
  address: string
  voteWeights: bigint[]
  voterWeight: number
  relativeWeight: number
  voteRound: number
  voteRoundTime: number
  numVotes: number
  nfd?: string
}

export type VoteRecord = {
  address: string
  proposal: string
  proposalIndex: number
  votes: number
  voterWeight: number
  voteRound: number
  voteRoundTime: number
  effect?:
    | "No Effect - Already Passed/Mock Proposal"
    | "Contributed To Passing - Proposal Passed"
    | "Contributed To Passing - Proposal Did Not Pass"
  percentOfThreshold?: number
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
  prompt: string
  proposalIndex?: number
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
  passedRound?: number | null
  passedTime?: number | null
  proposalIndex?: number
  proposal?: string
  threshold?: number
  passed?: "Passed" | "Not Passed"
}

export interface SessionResults extends SessionData {
  questionResults: QuestionResult[]
}

export interface VotingData {
  governors: GovernorsData
  results: SessionResults
  voters: VoterInfo[]
  votes: VoteRecord[]
}
