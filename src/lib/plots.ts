import { plot, barY, text, dotY, barX, stackX, ruleX, groupX, textX } from "@observablehq/plot"
import { Question, VotingData } from "./types"
import { SESSION_INFO } from "./constants"
import useData from "./useData"

const { votingData } = useData

export function weightParticipation(votingData: VotingData) {
  if (votingData) {
    const votedWeight = votingData.voters.reduce((sum, v) => (sum += v.voterWeight), 0)
    const totalWeight = votingData.governors.snapshot.reduce((sum, g) => (sum += g.weight), 0)
    const data = [
      {
        status: "Voted",
        total: votedWeight,
        fraction: votedWeight / totalWeight,
      },
      {
        status: "Not Voted",
        total: totalWeight - votedWeight,
        fraction: (totalWeight - votedWeight) / totalWeight,
      },
    ]
    return plot({
      title: "Voting Participation By Weight",
      subtitle: "How much voting weight voted or not?",
      width: 1280,
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

export function votesByEffect(votingData: VotingData) {
  if (votingData) {
    return plot({
      title: "Supporting Votes By Proposal, Weight, and Effect",
      subtitle: "How did votes contribute or not contribute to passing proposals?",
      color: { legend: true, scheme: "YlGnBu", reverse: true },
      style: { background: "none" },
      marginLeft: 110,
      width: 1280,
      x: { type: "band", label: "Proposal", domain: SESSION_INFO[3].proposalNums },
      y: { grid: true },
      marks: [
        barY(votingData?.votes, {
          x: "proposal",
          y: "votes",
          fill: "effect", //(d) => (d.effect === "No Effect - Already Passed/Mock Proposal" ? "grey" : "black"),
          sort: "effect",
          // stroke: "none",
          tip: "xy",
          title: (d) => (d.nfd ? d.nfd : d.address),
        }),
      ],
    })
  }
}

export function votesVsThrehold(votingData: VotingData) {
  if (votingData) {
    // Period 3 has mock proposal last again, so filter it
    const actualProposals = structuredClone(SESSION_INFO[3].proposalNums).filter((p) => p !== "01")
    // Period 1 had mock proposal 01 last so pop it
    // actualProposals.pop()
    // Period 2 has mock proposal first so shift it
    // actualProposals.shift()

    // Period 3 has mock proposal last again, so filter it
    const proposalsToGraph = structuredClone(votingData.results.questionResults).filter(
      (q) => q.proposal !== "01"
    )
    // Period 1 had mock proposal 01 last so pop it
    // proposalsToGraph.pop()
    // Period 2 has mock proposal first so shift it
    // proposalsToGraph.shift()
    return plot({
      title: "Total Supporting Voting Weight vs Passing Threshold By Proposal",
      subtitle: "Which proposals have passed?  How close are others to passing?",
      color: { legend: true, scheme: "PRGn" },
      style: { background: "none" },
      marginLeft: 110,
      width: 1280,
      x: { type: "band", label: "Proposal #", domain: actualProposals },
      y: { grid: true },
      marks: [
        barY(proposalsToGraph, {
          x: "proposal",
          y: "totalVotes",
          fill: "passed",
          title: "totalVotes",
        }),
        dotY(proposalsToGraph, {
          x: "proposal",
          y: "threshold",
          // tip: "y",
          // title: (d) => `${Math.round((d.totalVotes / d.threshold) * 100)}%`,
          symbol: "square",
          fill: (d) => (d.totalVotes > d.threshold ? "currentColor" : "none"),
          stroke: "black",
        }),
        text(proposalsToGraph, {
          text: (d) => `${Math.round((d.totalVotes / d.threshold) * 100)}%`,
          x: "proposal",
          y: "totalVotes",
          dx: 0,
          dy: -5,
          rotate: 270,
          textAnchor: "start",
          lineAnchor: "top",
        }),
      ],
    })
  }
}

export function accountsByProposal(votingData: VotingData) {
  if (votingData) {
    return plot({
      title: "Unique Accounts Supporting Each Proposal",
      subtitle: "How many different accounts supported each proposal?",
      style: { background: "none" },
      width: 1280,
      x: { domain: SESSION_INFO[3].proposalNums, label: "Proposal #" },
      y: { label: "# of Unique Accounts" },
      marks: [
        barY(votingData?.results.questionResults, {
          x: "proposal",
          y: "numVoters",
          fill: "turquoise",
          title: "numVoters",
        }),
        text(votingData?.results.questionResults, {
          text: "numVoters",
          x: "proposal",
          y: "numVoters",
          dy: -6,
        }),
      ],
    })
  }
}

export function votesPerVoter(votingData: VotingData) {
  if (votingData) {
    return plot({
      title: "Frequency of Number of Proposals Supported by Account",
      subtitle: "How many different proposals did individual accounts support?",
      style: { background: "none" },
      width: 1280,
      x: { label: "# Proposals Supported" },
      y: { label: "# of Unique Accounts" },
      marks: [barY(votingData?.voters, groupX({ y: "count" }, { x: "numVotes", fill: "tomato" }))],
    })
  }
}

export function votesBar(question: Question) {
  if (votingData()?.votes) {
    const proposalVotes = votingData()
      ?.votes.filter((v) => v.proposalIndex === question.proposalIndex)
      .reduce((acc, v) => {
        v.percentOfThreshold = v.votes / question.metadata.threshold
        acc.push(v)
        return acc
      }, [])
      .sort((a, b) => a.votes - b.votes)
    return plot({
      x: { percent: true },
      width: 1280,
      style: { background: "none" },
      marks: [
        barX(proposalVotes, stackX({ x: "percentOfThreshold", fill: "#636363" })),
        ruleX([0, 1]),
      ],
    })
  }
}

export function voterParticipation(votingData: VotingData) {
  if (votingData) {
    const data = [
      {
        status: "Voted",
        total: votingData.voters.length,
        fraction: votingData.voters.length / votingData.governors.snapshot.length,
      },
      {
        status: "Not Voted",
        total: votingData.governors.snapshot.length - votingData.voters.length,
        fraction:
          (votingData.governors.snapshot.length - votingData.voters.length) /
          votingData.governors.snapshot.length,
      },
    ]
    return plot({
      title: "Voting Participation By Account",
      subtitle: "How many unique accounts voted or not?",
      width: 1280,
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
