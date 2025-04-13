// src/lib/easterEggs.ts
import type { chrome } from "@types/chrome"

// Types for context
export type TabContext = {
  tabs: chrome.tabs.Tab[]
  query: string
  audioTabCount: number
}

export type EggEffectContext = {
  setUIFlag: (key: string, value: boolean) => void
  showMessage: (msg: string) => void
  currentDate?: Date
}

export type EasterEgg = {
  name: string
  trigger: (ctx: TabContext, date: Date) => boolean
  effect: (ctx: EggEffectContext) => void
}

// Chaos Mode — triggered by typing !chaos
export const chaosEgg: EasterEgg = {
  name: "Chaos Mode",
  trigger: ({ query }) => query.trim().toLowerCase() === "!chaos",
  effect: ({ setUIFlag, showMessage }) => {
    setUIFlag("chaos", true)
    showMessage("🌈 Chaos Mode Activated")
  }
}

// Self-Destruct Mode — triggered by typing !boom
export const boomEgg: EasterEgg = {
  name: "Self Destruct",
  trigger: ({ query }) => query.trim().toLowerCase() === "!boom",
  effect: ({ showMessage }) => {
    let count = 5
    const interval = setInterval(() => {
      if (count === 0) {
        clearInterval(interval)
        showMessage("💥 Just kidding. ATO is immortal.")
      } else {
        showMessage(`☠️ Self-destruct in ${count}...`)
        count--
      }
    }, 700)
  }
}

// Twitter Mode — if more than 5 twitter.com tabs
export const twitterEgg: EasterEgg = {
  name: "Too Much Twitter",
  trigger: ({ tabs }) => tabs.filter((t) => t.url?.includes("twitter.com")).length >= 5,
  effect: ({ showMessage }) => {
    showMessage("🐦 Flying a little close to the timeline, huh?")
  }
}

// DJ Tab — if more than 2 tabs are playing audio
export const djTabEgg: EasterEgg = {
  name: "DJ Tab",
  trigger: ({ audioTabCount }) => audioTabCount >= 2,
  effect: ({ showMessage }) => {
    showMessage("🎧 DJ Tab is live. Please don’t close the party.")
  }
}

// Calendar Date Messages
export const calendarEgg: EasterEgg = {
  name: "Calendar Message",
  trigger: (_, date) => {
    const m = date.getMonth() + 1 // 1-indexed
    const d = date.getDate()
    return [
      [4, 1], // April 1
      [5, 4], // May 4
      [10, 31], // Oct 31
      [12, 25], // Dec 25
      [12, 31], // Dec 31
    ].some(([month, day]) => m === month && d === day)
  },
  effect: ({ showMessage, currentDate }) => {
    if (!currentDate) return
    const m = currentDate.getMonth() + 1
    const d = currentDate.getDate()

    const messages: Record<string, string> = {
      "4-1": "🃏 ATO AI detected 42 useless tabs. Deleting in 3... 2... (jk)",
      "5-4": "🛸 May the Tabs be with you.",
      "10-31": "🎃 Beware: duplicate tabs may be haunted.",
      "12-25": "🎄 Merry Gitmas! Time to commit joy and push love.",
      "12-31": "🍾 You made it. Just 1 more tab before the new year."
    }

    const key = `${m}-${d}`
    const msg = messages[key]
    if (msg) showMessage(msg)
  }
}

export const easterEggs: EasterEgg[] = [
  chaosEgg,
  boomEgg,
  twitterEgg,
  djTabEgg,
  calendarEgg
]
