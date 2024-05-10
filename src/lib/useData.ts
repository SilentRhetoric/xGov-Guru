import { createMemo, createResource, createRoot, createSignal, onCleanup } from "solid-js"
import {
  Governor,
  GovernorsData,
  QuestionResult,
  SessionData,
  SessionResults,
  VoteRecord,
  VoterInfo,
  VotingData,
} from "./types"
import { timeBetweenDates } from "./utils"
import { ACTIVE_SESSION, SESSION_INFO } from "./constants"
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
  const [votingData] = createResource(getVotingData)
  const [sessionData] = createResource(fetchSessionData)
  const [questions, setQuestions] = createSignal<QuestionResult[]>([])
  const [expandGraphs, setExpandGraphs] = createSignal(true)
  const [expandedItem, setExpandedItem] = createSignal([""])
  const [sort, setSort] = createSignal("")

  const votesCsv = createMemo(() => {
    if (votingData()?.votes.length) {
      return createVotesCSV(votingData()?.votes)
    } else return null
  })

  const votersCsv = createMemo(() => {
    if (votingData()?.voters.length) {
      return createVotersCSV(votingData()?.voters)
    } else return null
  })

  const governorsCsv = createMemo(() => {
    if (votingData()?.governors.snapshot.length) {
      return createGovernorsCSV(votingData()?.governors.snapshot)
    } else return null
  })

  const [timerDetails, setTimerDetails] = createSignal(
    timeBetweenDates(new Date(sessionData()?.end).valueOf()).timeData
  )

  async function fetchSessionData(): Promise<SessionData> {
    const text = await fetch(SESSION_INFO[ACTIVE_SESSION].metadataUrl).then((response) =>
      response.text()
    )
    const sessionData: SessionData = JSON.parse(text)
    sessionData.questions.forEach((question, i) => {
      question.proposalIndex = i
      const abstract = question.description.split("#")[0] // Use only the content above the next heading
      if (abstract) {
        question.description = abstract
      }
      return question
    })
    const questions = sessionData.questions

    // Expand a proposal based on URL search params
    const currentUrl = new URL(window.location.href)
    const params = new URLSearchParams(currentUrl.search)
    const expandId = params.get("id")
    if (expandId) {
      const proposalToExpand = questions.find(
        (question) => `${parseInt(question.prompt.substring(1, 4))}` === expandId
      )
      if (proposalToExpand) {
        const indexOfProposal = questions.indexOf(proposalToExpand)
        if (indexOfProposal >= 0) {
          questions.splice(indexOfProposal, indexOfProposal)
          questions.unshift(proposalToExpand)
          setQuestions(questions)
          setExpandedItem([expandId])
          setExpandGraphs(false)
        }
      } else {
        setQuestions(questions)
      }
    } else {
      setQuestions(questions)
    }
    // console.debug("sessionData: ", sessionData)
    return sessionData
  }

  async function getProposal(expandedItem: string[]): Promise<string> {
    // const question = questions()[Number(expandedItem[0])]
    const question = questions().find(
      (question) => `${parseInt(question.prompt.substring(1, 4))}` === expandedItem[0]
    )
    // console.debug("question: ", question)
    const regex = /(?<=pull\/)\d+(?=\/files)/
    const pr = question && question.metadata.link.match(regex)
    if (pr && pr[0]) {
      const resp = await fetch(
        `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
      )
      if (resp.ok) {
        return `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
      } else {
        // Second attempt in case filename case is camelCase
        return `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xGov-${pr[0]}.md`
      }
    } else return ""
  }

  // Retrieve relevant vote txns from an indexer and create voter info from them
  async function getVoterInfo(): Promise<VoterInfo[]> {
    const results = await searchTransactions(
      indexerClient,
      (s) => s.applicationID(SESSION_INFO[ACTIVE_SESSION].appId),
      10000
    )
    // console.debug("results: ", results)
    const voteTxns = results.transactions.filter(
      (t) => t["application-transaction"]["application-args"][0] === "xA/9qg=="
    )
    // console.debug("Transactions: ", voteTxns)
    const voteWeightsType = new ABIArrayDynamicType(new ABIUintType(64))
    const allVotersInfo = voteTxns.map((txn) => {
      const address = txn.sender
      // Get the vote arrays from the application arguments
      const args = txn["application-transaction"]["application-args"]
      const votesEncoded = args[args.length - 2] // Second to last arg has the votes
      // console.debug("Vote weights encoded: ", votesEncoded)
      // Decode the vote weights array using ABI decoding
      const voteWeights = voteWeightsType.decode(
        new Uint8Array(Buffer.from(votesEncoded, "base64"))
      ) as bigint[]
      // console.debug("Vote weights: ", voteWeights)
      const voterWeight = Number(voteWeights.reduce((partialSum, w) => partialSum + w, 0n))
      const relativeWeight = voterWeight / SESSION_INFO[ACTIVE_SESSION].totalVotingWeight
      const voteRound = txn["confirmed-round"]
      const voteRoundTime = txn["round-time"]
      const numVotes = Number(
        voteWeights.reduce((count, vote) => {
          if (Number(vote) > 0) {
            return (count += 1)
          } else return count
        }, 0)
      )
      const alloUrl = `https://allo.info/account/${address}`
      const date = new Date()
      const formattedDate = date.toISOString().split("T")[0]
      const bitqueryUrl = `https://explorer.bitquery.io/algorand/address/${address}/graph?from=2019-06-11&till=${formattedDate}`

      const voterInfo = {
        address,
        voteWeights,
        voterWeight,
        relativeWeight,
        voteRound,
        voteRoundTime,
        numVotes,
        alloUrl,
        bitqueryUrl,
      }
      return voterInfo
    })
    return allVotersInfo
  }

  // Map over all voter info and break out the votes array into individual vote records by proposal
  function createVoteRecords(allVotersInfo: VoterInfo[]): VoteRecord[] {
    const allVoteRecords = allVotersInfo.flatMap((voterInfo) => {
      const voteRecords = voterInfo.voteWeights
        .map((vote, j) => {
          return {
            address: voterInfo.address,
            nfd: voterInfo.nfd,
            proposal: SESSION_INFO[ACTIVE_SESSION].proposalNums[j],
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
  async function getSessionMetaData(): Promise<SessionData> {
    const text = await fetch(SESSION_INFO[ACTIVE_SESSION].metadataUrl).then((response) =>
      response.text()
    )
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
    const text = await fetch(SESSION_INFO[ACTIVE_SESSION].governorDataUrl).then((response) =>
      response.text()
    )
    const governorsData: GovernorsData = JSON.parse(text)
    // console.debug("governorsData: ", governorsData)
    return governorsData
  }

  // Loop over the vote records and tally up cumulative votes on each proposal
  // If the vote pushed the proposal past the passing threshold, update the round and time it passed
  function createSessionResults(
    sessionData: SessionData,
    voteRecords: VoteRecord[]
  ): SessionResults {
    // console.debug("sessionDdata: ", sessionData)
    // console.debug("voteRecords: ", voteRecords)
    if (sessionData && voteRecords) {
      const sessionResultData = sessionData as SessionResults
      sessionResultData.questionResults = sessionResultData.questions
      sessionResultData.questionResults.forEach((q, i) => {
        q.proposalIndex = i
        q.proposal = SESSION_INFO[ACTIVE_SESSION].proposalNums[i]
        q.threshold = q.metadata.threshold
        q.passed = "Not Passed"
        q.passedRound = null
        q.passedTime = null
      })
      sessionResultData.questionResults.forEach(
        (q, i) => (q.proposal = SESSION_INFO[ACTIVE_SESSION].proposalNums[i])
      )
      sessionResultData.questionResults.forEach((q) => (q.threshold = q.metadata.threshold))
      sessionResultData.questionResults.forEach((q) => (q.passed = "Not Passed"))

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
    // console.debug("sessionResults: ", sessionResults)
    // console.debug("voteRecords: ", voteRecords)
    if (sessionResults && voteRecords) {
      const enrichedVoteRecords = voteRecords.map((v) => {
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
      // console.debug("enrichedVoteRecords: ", enrichedVoteRecords)
      return enrichedVoteRecords
    } else return undefined
  }

  // Pulls it all together for a resource that returns all the processed data
  async function getVotingData(): Promise<VotingData> {
    try {
      const votersInfo = await getVoterInfo()
      // console.debug("votersInfo: ", votersInfo)

      // Removing NFD lookup as it slows the initial load significantly
      // const enrichedVotersInfo = await nfdBatchLookup(votersInfo)

      // console.debug("enrichedVotersInfo: ", enrichedVotersInfo)
      const sessiondata = await getSessionMetaData()
      // console.debug("sessiondata: ", sessiondata)
      const governorsData = await getGovernorsData()
      // console.debug("governorsData: ", governorsData)
      const voteRecords = createVoteRecords(votersInfo)
      // console.debug("voteRecords: ", voteRecords)
      const sessionResults = createSessionResults(sessiondata, voteRecords)
      // console.debug("sessionResults: ", sessionResults)
      const enrichedVoteRecords = enrichVoteRecords(sessionResults, voteRecords)
      // console.debug("enrichedVoteRecords: ", enrichedVoteRecords)

      const votingData = {
        governors: governorsData,
        results: sessionResults,
        voters: votersInfo,
        votes: enrichedVoteRecords,
      }
      console.debug("votingData: ", votingData)
      return votingData
    } catch (e) {
      console.error(e)
    }
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
    const filename = "votes.csv"
    let blob = new Blob([fileContent], { type: "text/csv;charset=utf-8;" })
    let url = URL.createObjectURL(blob)
    return {
      filename,
      url,
    }
  }

  function createVotersCSV(voters: VoterInfo[]) {
    const csvRows: string[] = []
    // Remove the voteWeights field from the CSV as it is a a comma-separated array
    const fields = Object.keys(voters[0]).filter((field) => field !== "voteWeights")
    csvRows.push(fields.join(","))
    for (const voter of voters) {
      const values = fields.map((field) => {
        const val = voter[field]
        // console.debug("val: ", val)
        return `${val}`
      })
      csvRows.push(values.join(","))
    }
    const fileContent = csvRows.join("\n")
    const filename = "voters.csv"
    let blob = new Blob([fileContent], { type: "text/csv;charset=utf-8;" })
    let url = URL.createObjectURL(blob)
    return {
      filename,
      url,
    }
  }

  function createGovernorsCSV(governors: Governor[]) {
    const csvRows: string[] = []
    const fields = Object.keys(governors[0])
    csvRows.push(fields.join(","))
    for (const gov of governors) {
      const values = fields.map((field) => {
        const val = gov[field]
        return `${val}`
      })
      csvRows.push(values.join(","))
    }
    const fileContent = csvRows.join("\n")
    const filename = "governors.csv"
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
          return parseInt(a.prompt.substring(1, 4)) > parseInt(b.prompt.substring(1, 4))
            ? 1
            : parseInt(b.prompt.substring(1, 4)) > parseInt(a.prompt.substring(1, 4))
            ? -1
            : 0
        })

      setQuestions(sorted)
    }
    setSort("name")
  }

  // async function nfdBatchLookup(voters: VoterInfo[]) {
  //   const enrichedVoters = structuredClone(voters)
  //   const batchSize = 20
  //   for (let i = 0; i < voters.length; i += batchSize) {
  //     const batch = voters.slice(i, i + batchSize)
  //     const addrParams = batch.map((v) => `address=${v.address}&`).join("")
  //     // console.debug("addrParams: ", addrParams)
  //     const url = `https://api.nf.domains/nfd/v2/address?${addrParams}limit=1&view=tiny`

  //     try {
  //       const resp = await fetch(url)
  //       // console.debug("resp: ", resp)
  //       if (resp.ok) {
  //         const responseJson = await resp.json()
  //         // console.debug("responseJson: ", responseJson)
  //         Object.entries(responseJson).forEach(([addr, data]) => {
  //           const name = data[0].name
  //           // bug("NFD Name: ", name)
  //           const index = enrichedVoters.findIndex((v) => v.address === addr)
  //           enrichedVoters[index].nfd = name
  //           // console.debug("enrichedVoters[index]: ", enrichedVoters[index])
  //         })
  //       }
  //     } catch (e) {
  //       console.error("NFD address reverse lookup error: ", e)
  //     }
  //   }
  //   return enrichedVoters
  // }

  return {
    votingData,
    sessionData,
    expandGraphs,
    setExpandGraphs,
    questions,
    setQuestions,
    getProposal,
    expandedItem,
    setExpandedItem,
    sort,
    setSort,
    votesCsv,
    votersCsv,
    governorsCsv,
    timerDetails,
    setTimerDetails,
    sortAmount,
    sortName,
  }
}

export default createRoot(useData)
