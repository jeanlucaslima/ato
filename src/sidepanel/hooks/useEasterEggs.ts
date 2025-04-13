// src/sidepanel/hooks/useEasterEggs.ts
import { useEffect, useRef } from "react"
import { easterEggs } from "../../lib/easterEggs"
import type { TabContext, EggEffectContext } from "../../lib/easterEggs"

export function useEasterEggs(context: TabContext, actions: EggEffectContext) {
  const triggeredRef = useRef<Set<string>>(new Set())
  const today = new Date()

  useEffect(() => {
    easterEggs.forEach((egg) => {
      const alreadyTriggered = triggeredRef.current.has(egg.name)
      if (egg.trigger(context, today) && !alreadyTriggered) {
        triggeredRef.current.add(egg.name)
        egg.effect({ ...actions, currentDate: today })
      }
    })
  }, [context.tabs, context.query, context.audioTabCount])
}
