import { Accordion, Button } from "@kobalte/core"
import { For, createSignal, onMount } from "solid-js"

type Created = {
  at: string
  by: string
}

type Metadata = {
  ask: number
  category: string
  focus_area: string
  link: string
  threshold: number
}

type Options = {
  id: string
  label: string
}

type Question = {
  description: string
  id: string
  metadata: Metadata
  options: Options[]
  proposal_url: string
  prompt: string
}

type SessionData = {
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

export function numberWithCommas(num: number | string): string {
  const num_parts = num.toString().split(".")
  num_parts[0] = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return num_parts.join(".")
}

function App() {
  const [questions, setQuestions] = createSignal<Question[]>([])
  const [expandedItem, setExpandedItem] = createSignal([""])
  const [sort, setSort] = createSignal("name")

  async function fetchQuestions(): Promise<void> {
    const text = await fetch(
      `https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli`
    ).then((response) => response.text())
    const sessionData: SessionData = JSON.parse(text)
    // console.log(sessionData)
    sessionData.questions.forEach(async (q) => {
      const abstract = q.description.split("#")[0]
      if (abstract) {
        q.description = abstract
      }
      const regex = /(?<=pull\/)\d+(?=\/files)/
      const pr = q.metadata.link.match(regex)
      if (pr) {
        const resp = await fetch(
          `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
        )
        if (resp.ok) {
          q.proposal_url = `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
        } else {
          q.proposal_url = `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xGov-${pr[0]}.md`
        }
      }
      return q
    })
    const questions = sessionData.questions.reverse()
    setQuestions(questions)
  }

  onMount(() => fetchQuestions())

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
      const sorted = questions().slice().sort()
      setQuestions(sorted)
    }
    setSort("name")
  }

  return (
    <div class="relative mx-auto flex flex-col">
      <header class="sticky top-0 z-50 bg-gray-200 p-2">
        <div class="md mx-auto flex max-w-screen-lg flex-col flex-wrap items-center justify-between px-2 md:flex-row">
          <div class="flex">
            <h1 class="my-2 flex text-2xl font-bold">xGov Proposals</h1>
          </div>
          <div class="flex items-center gap-2">
            <Button.Root
              class=" flex h-12 w-12 items-center justify-center rounded-lg  border-[1.5px] border-black px-3 py-2 text-lg font-bold  hover:bg-gray-300 active:bg-gray-400"
              onClick={sortName}
            >
              #
            </Button.Root>
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
                d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
              />
            </svg>
            <Button.Root
              class="flex h-12 w-12 items-center justify-center rounded-lg border-[1.5px] border-black px-2 py-2 hover:bg-gray-300 active:bg-gray-400"
              onClick={sortAmount}
            >
              <svg
                class="h-6 w-6"
                viewBox="0 0 256 256"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="128"
                  cy="128"
                  r="128"
                  fill="black"
                />
                <path
                  d="M182.09 183.16H163.405L151.27 138.02L125.18 183.165H104.32L144.645 113.285L138.155 89.0248L83.7799 183.18H62.9099L131.82 63.8198H150.09L158.09 93.4748H176.94L164.07 115.855L182.09 183.16Z"
                  fill="white"
                />
              </svg>
            </Button.Root>
            <Button.Root
              class=" flex h-12 w-12 items-center justify-center rounded-lg border-[1.5px] border-black px-2 py-2  hover:bg-gray-300 active:bg-gray-400"
              onClick={() => setExpandedItem(() => [""])}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-6 w-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button.Root>
            <a
              class="flex h-12 items-center justify-center rounded-lg border-[1.5px] border-black px-2 py-2 text-lg  hover:bg-gray-300 active:bg-gray-400"
              href="https://xgov.algorand.foundation/vote/1158913461"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vote
            </a>
          </div>
        </div>
      </header>
      <div class="mx-auto max-w-screen-lg p-2">
        <Accordion.Root
          collapsible
          class="flex flex-col gap-2"
          value={expandedItem()}
          onChange={setExpandedItem}
        >
          <For each={questions()}>
            {(question, i) => (
              <Accordion.Item
                value={`item-${i() + 1}`}
                class="active: rounded-xl bg-blue-100 hover:bg-blue-200"
              >
                <Accordion.Header>
                  <Accordion.Trigger class="w-full p-2 text-left">
                    <h2 class="font-semibold">{question.prompt}</h2>
                    <p class="font-light">Category: {question.metadata.category}</p>
                    <p class="font-light">Focus Area: {question.metadata.focus_area}</p>
                    <p class="font-light">
                      Request: {numberWithCommas(question.metadata.ask)} Algos
                    </p>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content class="p-2">
                  <zero-md src={question.proposal_url}></zero-md>
                </Accordion.Content>
              </Accordion.Item>
            )}
          </For>
        </Accordion.Root>
      </div>
    </div>
  )
}

export default App
