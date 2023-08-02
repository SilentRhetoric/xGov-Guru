import { Accordion, Button } from "@kobalte/core"
import { createResource, type Component, For, createSignal } from "solid-js"

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
  proposal: string
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

async function fetchData(): Promise<SessionData> {
  const text = await fetch(
    `https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli`
  ).then((response) => response.text())
  const sessionData: SessionData = JSON.parse(text)
  console.log(sessionData)
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
        q.proposal = `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xgov-${pr[0]}.md`
      } else {
        q.proposal = `https://raw.githubusercontent.com/algorandfoundation/xGov/main/Proposals/xGov-${pr[0]}.md`
      }
    }
    return q
  })
  return sessionData
}

const App: Component = () => {
  const [data] = createResource<SessionData>(fetchData)
  const [expandedItem, setExpandedItem] = createSignal([""])

  return (
    <div class="relative mx-auto flex flex-col">
      <header class="sticky top-0 z-50 bg-gray-200 p-4">
        <div class="mx-auto flex max-w-screen-md items-center justify-between px-4">
          <div class="flex">
            <h1 class="flex text-2xl font-bold">xGov Proposals Viewer</h1>
          </div>
          <div class="flex">
            <a
              class="flex rounded-lg border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 active:bg-gray-400"
              href="https://xgov.algorand.foundation/vote/1158913461"
              target="_blank"
              rel="noopener noreferrer"
            >
              Voting Portal
            </a>
          </div>
        </div>
      </header>
      <div class="mx-auto max-w-screen-md p-4">
        <Accordion.Root
          collapsible
          class="flex flex-col gap-4"
          value={expandedItem()}
          onChange={setExpandedItem}
        >
          <For each={data()?.questions}>
            {(question, i) => (
              <Accordion.Item
                value={`item-${i() + 1}`}
                class="active: rounded-xl bg-blue-100 p-4  hover:bg-blue-200"
              >
                <Accordion.Header>
                  <Accordion.Trigger>
                    <div class="text-left">
                      <h2 class="text-lg font-semibold">{question.prompt}</h2>
                      <p>Category: {question.metadata.category}</p>
                      <p>Focus Area: {question.metadata.focus_area}</p>
                      <p>Requesting {question.metadata.ask} Algos</p>
                    </div>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content class="py-2">
                  <zero-md src={question.proposal}></zero-md>
                </Accordion.Content>
              </Accordion.Item>
            )}
          </For>
        </Accordion.Root>
      </div>
      <Button.Root
        class="fixed bottom-8 right-8 rounded-xl border-2 border-black bg-gray-200 px-4 py-2 font-bold"
        onClick={() => setExpandedItem(() => [""])}
      >
        Collapse
      </Button.Root>
    </div>
  )
}

export default App
