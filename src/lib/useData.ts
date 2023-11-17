import { createMemo, createResource, createRoot, createSignal, onCleanup } from "solid-js"
import {
  GovernorsData,
  QuestionResult,
  SessionData,
  SessionResults,
  VoteRecord,
  VoterInfo,
  VotingData,
} from "./types"
import { timeBetweenDates } from "./utils"
import {
  PERIOD_1_APP_ID,
  PERIOD_1_METADATA,
  PERIOD_1_PROPOSALS,
  PERIOD_1_TOTAL_VOTING_WEIGHT,
} from "./constants"
import { ABIArrayDynamicType, ABIUintType } from "algosdk"
import {
  getAlgoIndexerClient,
  getAlgoNodeConfig,
  searchTransactions,
} from "@algorandfoundation/algokit-utils"
import { Buffer } from "buffer"
// Added global = globalThis in index.html to make this work
globalThis.Buffer = Buffer

const indexerClient = getAlgoIndexerClient(getAlgoNodeConfig("mainnet", "indexer"))

function useData() {
  const [votingData, { mutate, refetch }] = createResource(getVotingData)
  const [sessionData] = createResource(fetchSessionData)
  const [questions, setQuestions] = createSignal<QuestionResult[]>([])
  const [expandedItem, setExpandedItem] = createSignal([""])
  const [sort, setSort] = createSignal("")
  const [proposal] = createResource(expandedItem, getProposal)
  const csv = createMemo(() => {
    if (votingData()?.votes.length) {
      return createVotesCSV(votingData()?.votes)
    } else return null
  })
  const [timerDetails, setTimerDetails] = createSignal(
    timeBetweenDates(new Date(sessionData()?.end).valueOf()).timeData
  )

  async function fetchSessionData(): Promise<SessionData> {
    const text = await fetch(PERIOD_1_METADATA).then((response) => response.text())
    const sessionData: SessionData = JSON.parse(text)
    sessionData.questions.forEach((question, i) => {
      question.proposalIndex = i
      const abstract = question.description.split("#")[0] // Use only the content above the next heading
      if (abstract) {
        question.description = abstract
      }
      return question
    })
    const questions = sessionData.questions.reverse()

    // Expand a proposal based on URL search params
    const currentUrl = new URL(window.location.href)
    const params = new URLSearchParams(currentUrl.search)
    const expandId = params.get("id")
    if (expandId) {
      const proposalToExpand = questions.find(
        (question) => `${parseInt(question.prompt.substring(1, 3))}` === expandId
      )
      if (proposalToExpand) {
        const indexOfProposal = questions.indexOf(proposalToExpand)
        if (indexOfProposal >= 0) {
          questions.splice(indexOfProposal, indexOfProposal)
          questions.unshift(proposalToExpand)
          setQuestions(questions)
          setExpandedItem([expandId])
        }
      } else {
        setQuestions(questions)
      }
    } else {
      setQuestions(questions)
    }
    return sessionData
  }

  async function getProposal(expandedItem: string[]): Promise<string> {
    // const question = questions()[Number(expandedItem[0])]
    const question = questions().find(
      (question) => `${parseInt(question.prompt.substring(1, 3))}` === expandedItem[0]
    )
    const regex = /(?<=pull\/)\d+(?=\/files)/
    const pr = question && question.metadata.link.match(regex)
    if (pr && pr[0]) {
      const resp = await fetch(
        `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
      )
      if (resp.ok) {
        return `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
      } else {
        // Second attempt in case filename case is camel
        return `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xGov-${pr[0]}.md`
      }
    } else return ""
  }

  // Retrieve relevant vote txns from an indexer and create voter info from them
  async function getVoterInfo(): Promise<VoterInfo[]> {
    const results = await searchTransactions(
      indexerClient,
      (s) => s.applicationID(PERIOD_1_APP_ID),
      5000
    )
    // console.debug(results)
    const voteTxns = results.transactions.filter(
      (t) => t["application-transaction"]["application-args"][0] === "xA/9qg=="
    )
    // console.debug("Transactions: ", txns)
    const voteWeightsType = new ABIArrayDynamicType(new ABIUintType(64))
    const allVotersInfo = voteTxns.map((txn) => {
      const address = txn.sender
      // Get the vote arrays from the application arguments
      const args = txn["application-transaction"]["application-args"]
      const votesEncoded = args[args.length - 2] // Second to last arg has the votes
      // console.debug("Vote weights encoded: ", voteWeights)
      // Decode the vote weights array using ABI decoding
      const voteWeights = voteWeightsType.decode(
        new Uint8Array(Buffer.from(votesEncoded, "base64"))
      ) as bigint[]
      // console.debug("Vote weights: ", voteWeights)
      const voterWeight = Number(voteWeights.reduce((partialSum, w) => partialSum + w, 0n))
      const relativeWeight = voterWeight / PERIOD_1_TOTAL_VOTING_WEIGHT
      const voteRound = txn["confirmed-round"]
      const voteRoundTime = txn["round-time"]
      const numVotes = Number(
        voteWeights.reduce((count, vote) => {
          if (Number(vote) > 0) {
            return (count += 1)
          } else return count
        }, 0)
      )
      const voterInfo = {
        address,
        voteWeights,
        voterWeight,
        relativeWeight,
        voteRound,
        voteRoundTime,
        numVotes,
      }
      return voterInfo
    })
    return allVotersInfo
  }

  // Map over all voter info and break out the votes array into individual vote records by proposal
  function createVoteRecords(allVotersInfo: VoterInfo[]): VoteRecord[] {
    const allVoteRecords = allVotersInfo.flatMap((voterInfo, i) => {
      const voteRecords = voterInfo.voteWeights
        .map((vote, j) => {
          return {
            address: voterInfo.address,
            nfd: voterInfo.nfd,
            proposal: PERIOD_1_PROPOSALS[j],
            proposalIndex: j,
            votes: Number(vote),
            voterWeight: Number(voterInfo.voterWeight),
            voteRound: voterInfo.voteRound,
            voteRoundTime: voterInfo.voteRoundTime,
          }
        })
        .filter((vote) => vote.votes > 0)

      return voteRecords
    })
    return allVoteRecords
  }

  // Get the xGov session data file from the Foundation's IPFS
  async function getSessionData(): Promise<SessionData> {
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

  async function getGovernorsData(): Promise<GovernorsData> {
    const text = await fetch(
      `https://api.voting.algorand.foundation/ipfs/bafkreieh77pgmvfexyxbnbexwu4n5x54kgdfop7lzfo26peyrjcwhn6uii`
    ).then((response) => response.text())
    const governorsData: GovernorsData = JSON.parse(text)
    // console.debug(governorsData)
    return governorsData
  }

  // Loop over the vote records and tally up cumulative votes on each proposal
  // If the vote pushed the proposal past the passing threshold, update the round and time it passed
  function createSessionResults(
    sessionData: SessionData,
    voteRecords: VoteRecord[]
  ): SessionResults {
    // console.debug("Session data: ", sessionData)
    // console.debug("All vote records: ", voteRecords)
    if (sessionData && voteRecords) {
      const sessionResultData = sessionData as SessionResults
      sessionResultData.questionResults = sessionResultData.questions
      sessionResultData.questionResults.forEach((q, i) => {
        q.proposalIndex = i
        q.proposal = PERIOD_1_PROPOSALS[i]
        q.threshold = q.metadata.threshold
        q.passed = "Not Passed"
        q.passedRound = null
        q.passedTime = null
      })
      sessionResultData.questionResults.forEach((q, i) => (q.proposal = PERIOD_1_PROPOSALS[i]))
      sessionResultData.questionResults.forEach((q, i) => (q.threshold = q.metadata.threshold))
      sessionResultData.questionResults.forEach((q, i) => (q.passed = "Not Passed"))

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
          sessionResultData.questionResults[v.proposalIndex].passedRound === null &&
          sessionResultData.questionResults[v.proposalIndex].passedTime === null
        ) {
          sessionResultData.questionResults[v.proposalIndex].passedRound = v.voteRound
          sessionResultData.questionResults[v.proposalIndex].passedTime = v.voteRoundTime
          sessionResultData.questionResults[v.proposalIndex].passed = "Passed"
        }
      })
      return sessionResultData
    }
  }

  // Loop over all vote records to enrich them with further data, such as if it was effectively wasted
  function enrichVoteRecords(sessionResults: SessionResults, voteRecords: VoteRecord[]) {
    // console.debug("Session results: ", sessionResults)
    // console.debug("All vote records: ", allVoteRecords)
    if (sessionResults && voteRecords) {
      const enrichedVoteRecords = voteRecords.map((v, i) => {
        if (
          sessionResults.questionResults[v.proposalIndex].passedRound === null &&
          v.proposal !== "01"
        ) {
          v.effect = "Contributed To Passing - Proposal Did Not Pass"
          return v
        } else if (
          (sessionResults.questionResults[v.proposalIndex].passedRound > 0 &&
            v.voteRound > sessionResults.questionResults[v.proposalIndex].passedRound) ||
          v.proposal === "01"
        ) {
          v.effect = "No Effect - Already Passed/Mock Proposal"
          return v
        } else if (
          sessionResults.questionResults[v.proposalIndex].passedRound > 0 &&
          v.voteRound <= sessionResults.questionResults[v.proposalIndex].passedRound
        ) {
          v.effect = "Contributed To Passing - Proposal Passed"
          return v
        }
      })
      // console.debug(enrichedVoteRecords)
      return enrichedVoteRecords
    } else return undefined
  }

  // Pulls it all together for a resource that returns all the processed data
  async function getVotingData(): Promise<VotingData> {
    try {
      const votersInfo = await getVoterInfo()
      const enrichedVotersInfo = await nfdBatchLookup(votersInfo)
      const sessiondata = await getSessionData()
      const governorsData = await getGovernorsData()
      const voteRecords = createVoteRecords(enrichedVotersInfo)
      const sessionResults = createSessionResults(sessiondata, voteRecords)
      const enrichedVoteRecords = enrichVoteRecords(sessionResults, voteRecords)
      // console.debug("sessionResults: ", sessionResults)
      // console.debug("voterInfo: ", voterInfo)
      // console.debug("enrichedVoteRecords: ", enrichedVoteRecords)
      // console.debug("governorsData: ", governorsData)
      // console.debug("enrichedVoters: ", enrichedVotersInfo)
      return {
        governors: governorsData,
        results: sessionResults,
        voters: enrichedVotersInfo,
        votes: enrichedVoteRecords,
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function nfdBatchLookup(voters: VoterInfo[]) {
    const enrichedVoters = structuredClone(voters)
    const batchSize = 20
    for (let i = 0; i < voters.length; i += batchSize) {
      const batch = voters.slice(i, i + batchSize)
      const addrParams = batch.map((v) => `address=${v.address}&`).join("")
      // console.debug("addrParams: ", addrParams)
      const url = `https://api.nf.domains/nfd/v2/address?${addrParams}limit=1&view=tiny`

      try {
        const resp = await fetch(url)
        // console.debug(resp)
        if (resp.ok) {
          const responseJson = await resp.json()
          // console.debug("responseJson: ", responseJson)
          Object.entries(responseJson).forEach(([addr, data]) => {
            const name = data[0].name
            // console.debug("NFD Name: ", name)
            const index = enrichedVoters.findIndex((v) => v.address === addr)
            enrichedVoters[index].nfd = name
            // console.debug(enrichedVoters[index])
          })
        }
      } catch (e) {
        console.error("NFD address reverse lookup error: ", e)
      }
    }
    return enrichedVoters
  }

  function createVotesCSV(votes: VoteRecord[]) {
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

  const timer = setInterval(() => {
    setTimerDetails(timeBetweenDates(new Date(sessionData()?.end).valueOf()).timeData)
  }, 1000)
  onCleanup(() => clearInterval(timer))

  function reverse() {
    const reversed = questions().slice().reverse()
    setQuestions(reversed)
  }

  function sortAmount() {
    if (sort() == "amount") {
      reverse()
    } else {
      const sorted = questions()
        .slice()
        .sort((a, b) => a.metadata.ask - b.metadata.ask)
      setQuestions(sorted)
    }
    setSort("amount")
  }

  function sortName() {
    if (sort() == "name") {
      reverse()
    } else {
      const sorted = questions()
        .slice()
        .sort((a, b) => {
          return parseInt(a.prompt.substring(1, 3)) > parseInt(b.prompt.substring(1, 3))
            ? 1
            : parseInt(b.prompt.substring(1, 3)) > parseInt(a.prompt.substring(1, 3))
            ? -1
            : 0
        })

      setQuestions(sorted)
    }
    setSort("name")
  }

  return {
    votingData,
    sessionData,
    questions,
    setQuestions,
    expandedItem,
    setExpandedItem,
    sort,
    setSort,
    proposal,
    csv,
    timerDetails,
    setTimerDetails,
    sortAmount,
    sortName,
  }
}

export default createRoot(useData)
