import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import type { Address } from "viem"
import {
  loadPreviewState,
  parsePreviewState,
  PREVIEW_STATE_KEY,
  previewProfileOf,
  savePreviewState,
  type PreviewResult,
  type PreviewState,
} from "./lib/previewLedger.ts"
import { fixtureHolder } from "./lib/payeeRules.ts"

type PreviewApi = {
  state: PreviewState
  rejectNext: boolean
  setRejectNext: (value: boolean) => void
  noAgent: boolean
  profileOf: (handle: string) => ReturnType<typeof previewProfileOf>
  holderOf: (handle: string) => Address
  apply: (result: PreviewResult) => { error?: string; hash?: `0x${string}` }
}

const PreviewContext = createContext<PreviewApi | null>(null)

export function PreviewProvider({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState(loadPreviewState)
  const [rejectNext, setRejectNext] = useState(false)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PREVIEW_STATE_KEY || !event.newValue) return
      const next = parsePreviewState(event.newValue)
      if (next) setState(next)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const api = useMemo<PreviewApi>(
    () => ({
      state,
      rejectNext,
      setRejectNext,
      noAgent: location.pathname.endsWith("/empty"),
      profileOf: (handle) => previewProfileOf(state, handle),
      holderOf: fixtureHolder,
      apply: (result) => {
        if (rejectNext) return { error: "rejected" }
        if (!result.error) {
          setState(result.state)
          savePreviewState(result.state)
        }
        return { error: result.error, hash: result.error ? undefined : result.hash }
      },
    }),
    [location.pathname, rejectNext, state],
  )
  return <PreviewContext.Provider value={api}>{children ?? <Outlet />}</PreviewContext.Provider>
}

export function usePreview() {
  return useContext(PreviewContext)
}
