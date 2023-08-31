import { Accordion, Button } from "@kobalte/core"
import {
  plot,
  barY,
  text,
  dotY,
  barX,
  stackX,
  ruleX,
  rectY,
  binX,
  groupX,
  textX,
} from "@observablehq/plot"
import { For, Show, Suspense, createMemo, createResource, createSignal, onCleanup } from "solid-js"
import { Question, SessionData, VotingData } from "./lib/types"
import { createVotesCSV, getVotingData, proposals } from "./lib/api"
import algonode from "./assets/algonode.png"

function numberWithCommas(num: number | string): string {
  const num_parts = num.toString().split(".")
  num_parts[0] = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return num_parts.join(".")
}

const dateOptions: Intl.DateTimeFormatOptions = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZoneName: "short",
}

const timeBetweenDates = (validTill: string | number) => {
  const validFromDate = new Date()
  const validTillTimeStamp = Number(validTill)
  const validTillDate = new Date(validTillTimeStamp)
  const difference = validTillDate.getTime() - validFromDate.getTime()

  let timeData = {
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  }

  if (difference > 0) {
    let seconds = Math.floor(difference / 1000)
    let minutes = Math.floor(seconds / 60)
    let hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    hours %= 24
    minutes %= 60
    seconds %= 60

    timeData = {
      days: `${days}`,
      hours: `${hours}`,
      minutes: `${minutes}`,
      seconds: `${seconds}`,
    }
  }
  return {
    timeData,
    difference,
  }
}

function App() {
  const [votingData, { mutate, refetch }] = createResource(getVotingData)
  const [sessionData] = createResource(fetchSessionData)
  const [questions, setQuestions] = createSignal<Question[]>([])
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

  const timer = setInterval(() => {
    setTimerDetails(timeBetweenDates(new Date(sessionData()?.end).valueOf()).timeData)
  }, 1000)
  onCleanup(() => clearInterval(timer))

  async function fetchSessionData(): Promise<SessionData> {
    const text = await fetch(
      `https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli`
    ).then((response) => response.text())
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

  function voterParticipation(votingData: VotingData) {
    if (votingData) {
      const data = [
        {
          status: "Voted",
          total: votingData.voters.length,
          fraction: votingData.voters.length / votingData.governors.snapshot.length,
        },
        {
          status: "Did Not Vote",
          total: votingData.governors.snapshot.length - votingData.voters.length,
          fraction:
            (votingData.governors.snapshot.length - votingData.voters.length) /
            votingData.governors.snapshot.length,
        },
      ]
      return plot({
        title: "Voting Participation By Account",
        subtitle: "How many unique accounts voted or did not vote?",
        width: 1000,
        style: { background: "none" },
        x: { percent: true, label: "Account Participation (%)" },
        marks: [
          barX(
            data,
            stackX({ x: "fraction", fill: (d) => (d.status === "Voted" ? "green" : "red") })
          ),
          textX(
            data,
            stackX({
              x: "fraction",
              text: (d) => `${d.status} (${d.total}, ${(d.fraction * 100).toFixed(2)}%)`,
              fill: "white",
            })
          ),
        ],
      })
    }
  }

  function weightParticipation(votingData: VotingData) {
    if (votingData) {
      const votedWeight = votingData.voters.reduce((sum, v) => (sum += v.voterWeight), 0)
      // console.debug("votedWeight: ", votedWeight)
      const totalWeight = votingData.governors.snapshot.reduce((sum, g) => (sum += g.weight), 0)
      // console.debug("totalWeight: ", totalWeight)
      const data = [
        {
          status: "Voted",
          total: votedWeight,
          fraction: votedWeight / totalWeight,
        },
        {
          status: "Did Not Vote",
          total: totalWeight - votedWeight,
          fraction: (totalWeight - votedWeight) / totalWeight,
        },
      ]
      return plot({
        title: "Voting Participation By Weight",
        subtitle: "How much voting weight voted or did not vote?",
        width: 1000,
        style: { background: "none" },
        x: { percent: true, label: "Voting Weight Participation (%)" },
        marks: [
          barX(
            data,
            stackX({ x: "fraction", fill: (d) => (d.status === "Voted" ? "green" : "red") })
          ),
          textX(
            data,
            stackX({
              x: "fraction",
              text: (d) => `${d.status} (${d.total}, ${(d.fraction * 100).toFixed(2)}%)`,
              fill: "white",
            })
          ),
        ],
      })
    }
  }

  function votesByEffect(votingData: VotingData) {
    if (votingData) {
      return plot({
        title: "Supporting Votes By Proposal, Weight, and Effect",
        subtitle: "How did votes contribute or not contribute to passing proposals?",
        color: { legend: true, scheme: "YlGnBu", reverse: true },
        style: { background: "none" },
        marginLeft: 110,
        width: 1000,
        x: { type: "band", label: "Proposal", domain: proposals },
        y: { grid: true },
        marks: [
          barY(votingData?.votes, {
            x: "proposal",
            y: "votes",
            fill: "effect", //(d) => (d.effect === "No Effect - Already Passed/Mock Proposal" ? "grey" : "black"),
            sort: "effect",
            // stroke: "none",
            // tip: "xy",
            // title: "address",
          }),
        ],
      })
    }
  }

  function votesVsThrehold(votingData: VotingData) {
    if (votingData) {
      const actualProposals = structuredClone(proposals)
      actualProposals.pop()
      const proposalsToGraph = structuredClone(votingData.results.questionResults)
      proposalsToGraph.pop()
      return plot({
        title: "Total Supporting Voting Weight vs Passing Threshold By Proposal",
        subtitle: "Which proposals have passed?  How close are others to passing?",
        color: { legend: true, scheme: "PRGn" },
        style: { background: "none" },
        marginLeft: 110,
        width: 1000,
        x: { type: "band", label: "Proposal", domain: actualProposals },
        y: { grid: true },
        marks: [
          barY(proposalsToGraph, {
            x: "proposal",
            y: "totalVotes",
            fill: "passed",
          }),
          dotY(proposalsToGraph, {
            x: "proposal",
            y: "threshold",
            // tip: "xy",
            // title: (d) => `${Math.round((d.totalVotes / d.threshold) * 100)}%`,
            symbol: "square",
            fill: (d) => (d.totalVotes > d.threshold ? "currentColor" : "none"),
            stroke: "black",
          }),
          text(proposalsToGraph, {
            text: (d) => `${Math.round((d.totalVotes / d.threshold) * 100)}%`,
            x: "proposal",
            y: "totalVotes",
            dx: 6,
            dy: -5,
            rotate: 270,
            textAnchor: "start",
            lineAnchor: "top",
          }),
        ],
      })
    }
  }

  function accountsByProposal(votingData: VotingData) {
    if (votingData) {
      return plot({
        title: "Unique Accounts Supporting Each Proposal",
        subtitle: "How many different accounts supported each proposal?",
        style: { background: "none" },
        width: 1000,
        x: { domain: proposals, label: "Proposals" },
        y: { label: "# of Unique Accounts" },
        marks: [
          barY(votingData?.results.questionResults, {
            x: "proposal",
            y: "numVoters",
            fill: "turquoise",
          }),
        ],
      })
    }
  }

  function votesPerVoter(votingData: VotingData) {
    if (votingData) {
      return plot({
        title: "Frequency of Number of Proposals Supported by Account",
        subtitle: "How many different proposals did individual accounts support?",
        style: { background: "none" },
        width: 1000,
        x: { label: "# Proposals Supported" },
        y: { label: "# of Unique Accounts" },
        marks: [
          barY(votingData?.voters, groupX({ y: "count" }, { x: "numVotes", fill: "tomato" })),
        ],
      })
    }
  }

  function votesBar(question: Question) {
    if (votingData()?.votes) {
      const proposalVotes = votingData()
        ?.votes.filter((v) => v.proposalIndex === question.proposalIndex)
        .reduce((acc, v, i) => {
          v.percentOfThreshold = v.votes / question.metadata.threshold
          acc.push(v)
          return acc
        }, [])
        .sort((a, b) => a.votes - b.votes)
      return plot({
        x: { percent: true },
        width: 1000,
        style: { background: "none" },
        marks: [
          barX(proposalVotes, stackX({ x: "percentOfThreshold", fill: "#636363" })),
          ruleX([0, 1]),
        ],
      })
    }
  }

  return (
    <div class="relative mx-auto flex flex-col bg-neutral-100">
      <header class="sticky top-0 z-50 border-b-[0.5px] border-black bg-neutral-200">
        <div class="mx-auto flex max-w-screen-lg flex-col flex-wrap items-center justify-between px-4 py-2 md:flex-row">
          <div class="flex">
            <h1 class="my-2 flex font-bold">xGov Viewer</h1>
          </div>
          <div class="flex items-center gap-2">
            <Button.Root
              class="flex h-12 w-12 items-center justify-center rounded-xl border-[0.5px] border-black px-3 py-2 text-xl font-semibold hover:bg-neutral-300 active:bg-neutral-400"
              onClick={sortName}
              aria-label="Sort by number"
            >
              #
            </Button.Root>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="mx-1 h-6 w-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
              />
            </svg>
            <Button.Root
              class="flex h-12 w-12 items-center justify-center rounded-xl border-[0.5px] border-black px-2 py-2 hover:bg-neutral-300 active:bg-neutral-400"
              onClick={sortAmount}
              aria-label="Sort by amount"
            >
              <svg
                width="238.36px"
                height="238.72px"
                viewBox="0 0 238.36 238.72"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
              >
                <g
                  id="Page-1"
                  stroke="none"
                  stroke-width="1"
                  fill="none"
                  fill-rule="evenodd"
                >
                  <g
                    id="algorand_logo_mark_black"
                    fill="#000000"
                    fill-rule="nonzero"
                  >
                    <polygon
                      id="Path"
                      points="238.36 238.68 200.99 238.68 176.72 148.4 124.54 238.69 82.82 238.69 163.47 98.93 150.49 50.41 41.74 238.72 0 238.72 137.82 0 174.36 0 190.36 59.31 228.06 59.31 202.32 104.07"
                    ></polygon>
                  </g>
                </g>
              </svg>
            </Button.Root>
            <a
              class="flex h-12 w-24 items-center justify-center rounded-xl border-[0.5px] border-black px-2 py-2 text-xl font-light hover:bg-neutral-300 active:bg-neutral-400"
              href="https://xgov.algorand.foundation/vote/1158913461"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vote
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-6 w-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75"
                />
              </svg>
            </a>
          </div>
        </div>
      </header>
      <div class="mx-auto flex w-full max-w-screen-lg flex-col gap-2 p-2">
        <div class="rounded-xl border-[0.5px] border-black p-2">
          <Suspense fallback={<span>Loading session details...</span>}>
            <h2 class="font-semibold">Algorand xGov Session Details</h2>
            <p class="font-semibold">
              Session Title: <span class="font-light">{sessionData()?.title}</span>
            </p>
            <p class="font-semibold">
              Session Description: <span class="font-light">{sessionData()?.description}</span>
            </p>
            <p class="font-semibold">
              Discussion Forum:{" "}
              <a
                class="font-light text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                href={sessionData()?.informationUrl}
              >
                {sessionData()?.informationUrl}
              </a>
            </p>
            <p class="font-semibold">
              Session Start:{" "}
              <span class="font-light">
                {new Date(sessionData()?.start).toLocaleString(undefined, dateOptions)}
              </span>
            </p>
            <p class="font-semibold">
              Session End:{" "}
              <span class="font-light">
                {new Date(sessionData()?.end).toLocaleString(undefined, dateOptions)}
              </span>
            </p>
            <p class="font-semibold">
              Time Remaining:{" "}
              <span class="font-light">
                {timerDetails().days}d {timerDetails().hours}h {timerDetails().minutes}m{" "}
                {timerDetails().seconds}s
              </span>
            </p>
            <p class="font-light">
              Click the proposal tiles below the graphs to view full information about each proposal
            </p>
          </Suspense>
        </div>
        <Suspense
          fallback={
            <div class="rounded-xl border-[0.5px] border-black p-2">Generating graphs... 📊</div>
          }
        >
          {/* <Button.Root onClick={() => logNFds()}>Log NFDs</Button.Root> */}
          <Show when={csv()}>
            <a
              href={csv().url}
              download={csv().filename}
              class="flex"
            >
              <Button.Root class="flex h-12 w-full gap-2 rounded-xl border-[0.5px] border-black px-3 py-2 text-xl hover:bg-neutral-300 active:bg-neutral-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-6 w-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25"
                  />
                </svg>
                <p class="font-light">Download votes data as .csv file</p>
              </Button.Root>
            </a>
          </Show>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {voterParticipation(votingData())}
          </div>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {weightParticipation(votingData())}
          </div>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {votesByEffect(votingData())}
          </div>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {votesVsThrehold(votingData())}
          </div>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {accountsByProposal(votingData())}
          </div>
          <div class="rounded-xl border-[0.5px] border-black p-2">
            {votesPerVoter(votingData())}
          </div>
        </Suspense>
        <Accordion.Root
          collapsible
          class="flex flex-col gap-2"
          value={expandedItem()}
          onChange={setExpandedItem}
        >
          <For each={questions()}>
            {(question) => (
              <Accordion.Item
                value={`${parseInt(question.prompt.substring(1, 3))}`}
                class="rounded-xl border-[0.5px] border-black bg-neutral-200 hover:bg-neutral-300 active:bg-neutral-400"
              >
                <Accordion.Trigger class="w-full p-2 text-left font-light">
                  <p class="font-semibold">{question.prompt}</p>
                  <div class="flex flex-row text-sm leading-tight">
                    <p class="w-24">Category: </p>
                    <p>{question.metadata.category}</p>
                  </div>
                  <div class="flex flex-row text-sm leading-tight">
                    <p class="w-24">Focus Area: </p>
                    <p>{question.metadata.focus_area}</p>
                  </div>
                  <div class="flex flex-row text-sm leading-tight">
                    <p class="w-24">Request: </p>
                    <p>{numberWithCommas(question.metadata.ask)} Algos</p>
                  </div>
                  <div></div>
                  <Accordion.Content class="py-2">
                    <div>{votesBar(question)}</div>
                    <Suspense
                      fallback={<p class="font-light">{"Loading proposal from GitHub..."}</p>}
                    >
                      {/* @ts-ignore */}
                      <zero-md src={proposal()}></zero-md>
                    </Suspense>
                  </Accordion.Content>
                </Accordion.Trigger>
              </Accordion.Item>
            )}
          </For>
        </Accordion.Root>
      </div>
      <footer class="flex flex-col justify-center gap-2 px-4 py-8 font-light">
        <a
          href="https://x.com/silentrhetoric"
          target="_blank"
          class="flex flex-row"
        >
          <svg
            viewBox="0 0 24 24"
            class="fill-primary h-6 w-6"
          >
            <g>
              <path d="M14.258 10.152L23.176 0h-2.113l-7.747 8.813L7.133 0H0l9.352 13.328L0 23.973h2.113l8.176-9.309 6.531 9.309h7.133zm-2.895 3.293l-.949-1.328L2.875 1.56h3.246l6.086 8.523.945 1.328 7.91 11.078h-3.246zm0 0"></path>
            </g>
          </svg>
          <p class="ml-2">Made with &#9829; by SilentRhetoric</p>{" "}
        </a>
        <a
          href="https://github.com/SilentRhetoric/xGov-viewer"
          aria-label="GitHub repository"
          target="_blank"
          class="flex flex-row"
        >
          <svg
            width="25"
            height="24"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12.846 0c-6.63 0-12 5.506-12 12.303 0 5.445 3.435 10.043 8.205 11.674.6.107.825-.262.825-.585 0-.292-.015-1.261-.015-2.291-3.015.569-3.795-.754-4.035-1.446-.135-.354-.72-1.446-1.23-1.738-.42-.23-1.02-.8-.015-.815.945-.015 1.62.892 1.845 1.261 1.08 1.86 2.805 1.338 3.495 1.015.105-.8.42-1.338.765-1.645-2.67-.308-5.46-1.37-5.46-6.075 0-1.338.465-2.446 1.23-3.307-.12-.308-.54-1.569.12-3.26 0 0 1.005-.323 3.3 1.26.96-.276 1.98-.415 3-.415s2.04.139 3 .416c2.295-1.6 3.3-1.261 3.3-1.261.66 1.691.24 2.952.12 3.26.765.861 1.23 1.953 1.23 3.307 0 4.721-2.805 5.767-5.475 6.075.435.384.81 1.122.81 2.276 0 1.645-.015 2.968-.015 3.383 0 .323.225.707.825.585a12.047 12.047 0 0 0 5.919-4.489 12.537 12.537 0 0 0 2.256-7.184c0-6.798-5.37-12.304-12-12.304Z"
            ></path>
          </svg>
          <p class="ml-2 flex">Contribute to this open source project</p>
        </a>
        <a
          href="https://algonode.io"
          aria-label="AlgoNode"
          target="_blank"
          class="flex flex-row"
        >
          <img
            src={algonode}
            class="m-[-3px] h-8 w-8"
          />
          <p class="ml-2">Powered by AlgoNode</p>
        </a>
      </footer>
    </div>
  )
}

export default App
