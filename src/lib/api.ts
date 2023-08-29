import * as algokit from "@algorandfoundation/algokit-utils"
import { ABIArrayDynamicType, ABIUintType } from "algosdk"
import { Buffer } from "buffer"
import { SessionData, SessionResults, VoteRecord, VoterInfo, VotingData } from "./types"

const indexerClient = algokit.getAlgoIndexerClient(algokit.getAlgoNodeConfig("mainnet", "indexer"))
const xGov1App = 1158913461
const totalVoters = 4765
const totalVotingWeight = 2139007219936
export const proposals = [
  "06",
  "08",
  "09",
  "14",
  "17",
  "18",
  "19",
  "20",
  "23",
  "24",
  "25",
  "26",
  "28",
  "30",
  "31",
  "32",
  "33",
  "34",
  "37",
  "38",
  "39",
  "41",
  "42",
  "43",
  "48",
  "49",
  "01",
]

// Retrieve relevant vote txns from an indexer and create voter info from them
export async function getVoterInfo(): Promise<VoterInfo[]> {
  const results = await algokit.searchTransactions(
    indexerClient,
    (s) => s.applicationID(xGov1App),
    5000
  )
  // console.debug(results)

  const voteTxns = results.transactions.filter(
    (t) => t["application-transaction"]["application-args"][0] === "xA/9qg=="
  )
  // console.debug("Transactions: ", txns)

  const allVotersInfo = voteTxns.map((txn) => {
    const address = txn.sender

    // Get the vote arrays from the application arguments
    const args = txn["application-transaction"]["application-args"]
    const votesEncoded = args[args.length - 2] // Second to last arg has the votes
    // console.debug("Vote weights encoded: ", voteWeights)

    // Decode the vote weights array using ABI decoding
    const voteWeightsType = new ABIArrayDynamicType(new ABIUintType(64))
    const voteWeights = voteWeightsType.decode(
      new Uint8Array(Buffer.from(votesEncoded, "base64"))
    ) as bigint[]
    // console.debug("Vote weights: ", voteWeights)

    const voterWeight = Number(voteWeights.reduce((partialSum, w) => partialSum + w, 0n))
    const relativeWeight = voterWeight / totalVotingWeight
    const voteRound = txn["confirmed-round"]
    const voteRoundTime = txn["round-time"]

    const voterInfo = {
      address,
      voteWeights,
      voterWeight,
      relativeWeight,
      voteRound,
      voteRoundTime,
    }
    return voterInfo
  })
  return allVotersInfo
}

// Map over all voter info and break out the votes array into individual vote records by proposal
export function createVoteRecords(allVotersInfo: VoterInfo[]): VoteRecord[] {
  const allVoteRecords = allVotersInfo.flatMap((voterInfo, i) => {
    const voteRecords = voterInfo.voteWeights.map((vote, j) => {
      return {
        address: voterInfo.address,
        proposal: proposals[j],
        proposalIndex: j,
        votes: Number(vote),
        voterWeight: Number(voterInfo.voterWeight),
        voteRound: voterInfo.voteRound,
        voteRoundTime: voterInfo.voteRoundTime,
      }
    })
    return voteRecords
  })
  return allVoteRecords
}

// Get the xGov session data file from the Foundation's IPFS
export async function getSessionData(): Promise<SessionData> {
  const text = await fetch(
    `https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli`
  ).then((response) => response.text())
  const sessionData: SessionData = JSON.parse(text)
  sessionData.questions.forEach((question) => {
    const abstract = question.description.split("#")[0] // Use only the content above the next heading
    if (abstract) {
      question.description = abstract
    }
    return question
  })
  return sessionData
}

// Loop over the vote records and tally up cumulative votes on each proposal
// If the vote pushed the proposal past the passing threshold, update the round and time it passed
export function createSessionResults(
  sessionData: SessionData,
  voteRecords: VoteRecord[]
): SessionResults {
  // console.debug("Session data: ", sessionData)
  // console.debug("All vote records: ", voteRecords)
  if (sessionData && voteRecords) {
    const sessionResultData = sessionData as SessionResults
    sessionResultData.questionResults = sessionResultData.questions
    sessionResultData.questionResults.forEach((q, i) => (q.proposalIndex = i))
    sessionResultData.questionResults.forEach((q, i) => (q.proposal = proposals[i]))
    sessionResultData.questionResults.forEach((q, i) => (q.threshold = q.metadata.threshold))
    sessionResultData.questionResults.forEach((q, i) => (q.passed = false))
    voteRecords.forEach((v) => {
      sessionResultData.questionResults[v.proposalIndex].totalVotes =
        sessionResultData.questionResults[v.proposalIndex].totalVotes + v.votes || v.votes
      if (v.votes > 0) {
        sessionResultData.questionResults[v.proposalIndex].numVoters =
          sessionResultData.questionResults[v.proposalIndex].numVoters + 1 || 1
      }
      if (
        sessionResultData.questionResults[v.proposalIndex].totalVotes >
          sessionResultData.questionResults[v.proposalIndex].metadata.threshold &&
        sessionResultData.questionResults[v.proposalIndex].passedRound === undefined &&
        sessionResultData.questionResults[v.proposalIndex].passedTime === undefined
      ) {
        sessionResultData.questionResults[v.proposalIndex].passedRound = v.voteRound
        sessionResultData.questionResults[v.proposalIndex].passedTime = v.voteRoundTime
        sessionResultData.questionResults[v.proposalIndex].passed = true
      }
    })
    return sessionResultData
  }
}

// Loop over all vote records to enrich them with further data, such as if it was effectively wasted
export function enrichVoteRecords(sessionResults: SessionResults, voteRecords: VoteRecord[]) {
  // console.debug("Session results: ", sessionResults)
  // console.debug("All vote records: ", allVoteRecords)
  if (sessionResults && voteRecords) {
    const enrichedVoteRecords = voteRecords.map((v, i) => {
      if (
        v.voteRound > sessionResults.questionResults[v.proposalIndex].passedRound ||
        v.proposal === "01"
      ) {
        v.effect = "No Effect - Above Threshold"
        return v
      } else {
        v.effect = "Contributed To Passing - Below Threshold"
        return v
      }
    })
    // console.debug(enrichedVoteRecords)
    return enrichedVoteRecords
  } else return undefined
}

// Pulls it all together for a resource that returns all the processed data
export async function getVotingData(): Promise<VotingData> {
  try {
    const voterInfo = await getVoterInfo()
    const sessiondata = await getSessionData()
    const voteRecords = createVoteRecords(voterInfo)
    const sessionResults = createSessionResults(sessiondata, voteRecords)
    const enrichedVoteRecords = enrichVoteRecords(sessionResults, voteRecords)
    // console.debug("sessionResults: ", sessionResults)
    // console.debug("voterInfo: ", voterInfo)
    // console.debug("enrichedVoteRecords: ", enrichedVoteRecords)
    return {
      results: sessionResults,
      voters: voterInfo,
      votes: enrichedVoteRecords,
    }
  } catch (e) {
    console.error(e)
  }
}

export function createVotesCSV(votes: VoteRecord[]) {
  const csvRows: string[] = []
  const fields = Object.keys(votes[0])
  csvRows.push(fields.join(","))
  for (const vote of votes) {
    const values = fields.map((field) => {
      const val = vote[field]
      return `${val}`
    })
    csvRows.push(values.join(","))
  }
  const fileContent = csvRows.join("\n")
  const filename = "xGov_1_votes.csv"
  let blob = new Blob([fileContent], { type: "text/csv;charset=utf-8;" })
  let url = URL.createObjectURL(blob)
  return {
    filename,
    url,
  }
}
