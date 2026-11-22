import { createContext, type ReactNode, useContext, useMemo, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { type Address, zeroAddress } from "viem"
import { USDC } from "./config.ts"
import { agentTokenId } from "./lib/handles.ts"
import { parseAmount } from "./lib/format.ts"
import type { InvoiceInput, InvoiceModel, PassModel, ProfileInput, ProfileModel, TipInput, TipModel } from "./models.ts"

export const PREVIEW_ADA = "0x1111111111111111111111111111111111111111" as Address
export const PREVIEW_BAO = "0x2222222222222222222222222222222222222222" as Address

const adaId = agentTokenId("ada")
const baoId = agentTokenId("bao")

function now() {
  return BigInt(Math.floor(Date.now() / 1000))
}

function emptyProfile(handle: string): ProfileModel {
  return {
    active: false,
    tipsOpen: true,
    passOpen: false,
    passToken: zeroAddress,
    passPrice: 0n,
    handle,
    bio: "",
    passLabel: "",
  }
}

const baoProfile: ProfileModel = {
  active: true,
  tipsOpen: true,
  passOpen: true,
  passToken: zeroAddress,
  passPrice: parseAmount("0.02") ?? 0n,
  handle: "bao",
  bio: "A small studio that invoices by name.",
  passLabel: "studio",
}

function invoice(partial: InvoiceModel): InvoiceModel {
  return partial
}

const initialInvoices: InvoiceModel[] = [
  invoice({
    id: 1n,
    recipientAgentId: baoId,
    token: zeroAddress,
    amount: parseAmount("0.1") ?? 0n,
    deadline: 0n,
    restrictedPayerAgentId: 0n,
    mintPass: true,
    paid: false,
    cancelled: false,
    payerAgentId: 0n,
    paidTo: zeroAddress,
    paidAt: 0n,
    handle: "bao",
    memo: "poster",
    passLabel: "show",
    restrictedPayerHandle: "",
  }),
  invoice({
    id: 2n,
    recipientAgentId: baoId,
    token: USDC,
    amount: parseAmount("5") ?? 0n,
    deadline: 0n,
    restrictedPayerAgentId: adaId,
    mintPass: false,
    paid: false,
    cancelled: false,
    payerAgentId: 0n,
    paidTo: zeroAddress,
    paidAt: 0n,
    handle: "bao",
    memo: "retainer",
    passLabel: "",
    restrictedPayerHandle: "ada",
  }),
]

export type PreviewState = {
  viewerHandle: string
  viewerId: bigint
  profiles: Record<string, ProfileModel>
  invoices: InvoiceModel[]
  tips: TipModel[]
  passes: PassModel[]
  nextInvoiceId: bigint
  nextTipId: bigint
  nextPassId: bigint
}

const initialState: PreviewState = {
  viewerHandle: "ada",
  viewerId: adaId,
  profiles: { bao: baoProfile },
  invoices: initialInvoices,
  tips: [],
  passes: [],
  nextInvoiceId: 3n,
  nextTipId: 1n,
  nextPassId: 1n,
}

type Result = { state: PreviewState; error?: string }

function holderOf(handle: string) {
  if (handle === "ada") return PREVIEW_ADA
  if (handle === "bao") return PREVIEW_BAO
  return zeroAddress
}

export function previewProfile(state: PreviewState, input: ProfileInput): Result {
  const price = input.passOpen ? parseAmount(input.passPrice || "0") : 0n
  if (input.passOpen && price === null) return { state, error: "badAmount" }
  if (input.bio.length > 140 || input.passLabel.length > 48) return { state, error: "tooLong" }
  const profile: ProfileModel = {
    active: true,
    tipsOpen: input.tipsOpen,
    passOpen: input.passOpen,
    passToken: input.passOpen ? input.passToken : zeroAddress,
    passPrice: price ?? 0n,
    handle: state.viewerHandle,
    bio: input.bio,
    passLabel: input.passOpen ? input.passLabel || "access" : "",
  }
  return { state: { ...state, profiles: { ...state.profiles, [state.viewerHandle]: profile } } }
}

export function previewInvoice(state: PreviewState, input: InvoiceInput): Result {
  const amount = parseAmount(input.amount || "0")
  if (amount === null) return { state, error: "badAmount" }
  if (input.memo.length > 140 || input.passLabel.length > 48) return { state, error: "tooLong" }
  if (input.onlyName && !input.restricted.trim()) return { state, error: "needName" }
  let restrictedId = 0n
  let restrictedHandle = ""
  if (input.onlyName) {
    restrictedHandle = input.restricted.trim().toLowerCase().replace(/\.ai$/, "")
    if (restrictedHandle !== "ada" && restrictedHandle !== "bao") return { state, error: "UnknownHandle" }
    if (restrictedHandle === state.viewerHandle) return { state, error: "SelfPayment" }
    restrictedId = agentTokenId(restrictedHandle)
  }
  const deadline = input.deadline ? BigInt(Math.floor(new Date(input.deadline).getTime() / 1000)) : 0n
  if (input.deadline && Number.isNaN(new Date(input.deadline).getTime())) return { state, error: "badDeadline" }
  if (deadline !== 0n && deadline <= now()) return { state, error: "DeadlineInPast" }
  const id = state.nextInvoiceId
  const created: InvoiceModel = {
    id,
    recipientAgentId: state.viewerId,
    token: input.token,
    amount,
    deadline,
    restrictedPayerAgentId: restrictedId,
    mintPass: input.mintPass,
    paid: false,
    cancelled: false,
    payerAgentId: 0n,
    paidTo: zeroAddress,
    paidAt: 0n,
    handle: state.viewerHandle,
    memo: input.memo,
    passLabel: input.mintPass ? input.passLabel || "access" : "",
    restrictedPayerHandle: restrictedHandle,
  }
  return { state: { ...state, invoices: [created, ...state.invoices], nextInvoiceId: id + 1n } }
}

export function previewCancel(state: PreviewState, id: bigint): Result {
  const found = state.invoices.find((item) => item.id === id)
  if (!found) return { state, error: "InvoiceMissing" }
  if (found.paid) return { state, error: "AlreadyPaid" }
  if (found.cancelled) return { state, error: "InvoiceAlreadyCancelled" }
  if (found.recipientAgentId !== state.viewerId) return { state, error: "NotRecipient" }
  return {
    state: {
      ...state,
      invoices: state.invoices.map((item) => (item.id === id ? { ...item, cancelled: true } : item)),
    },
  }
}

export function previewPay(state: PreviewState, id: bigint): Result {
  const found = state.invoices.find((item) => item.id === id)
  if (!found) return { state, error: "InvoiceMissing" }
  if (found.paid) return { state, error: "AlreadyPaid" }
  if (found.cancelled) return { state, error: "InvoiceAlreadyCancelled" }
  if (found.deadline !== 0n && now() > found.deadline) return { state, error: "InvoiceExpired" }
  if (found.recipientAgentId === state.viewerId) return { state, error: "SelfPayment" }
  if (found.restrictedPayerAgentId !== 0n && found.restrictedPayerAgentId !== state.viewerId) {
    return { state, error: "PayerNotAllowed" }
  }
  const passes = [...state.passes]
  let nextPassId = state.nextPassId
  if (found.mintPass) {
    passes.unshift(makePass(state, nextPassId, found.handle, found.passLabel || "access", found.id, found.token, found.amount))
    nextPassId += 1n
  }
  return {
    state: {
      ...state,
      nextPassId,
      passes,
      invoices: state.invoices.map((item) =>
        item.id === id
          ? { ...item, paid: true, payerAgentId: state.viewerId, paidTo: holderOf(item.handle), paidAt: now() }
          : item,
      ),
    },
  }
}

export function previewTip(state: PreviewState, handle: string, input: TipInput): Result {
  if (handle !== "ada" && handle !== "bao") return { state, error: "UnknownHandle" }
  if (handle === state.viewerHandle) return { state, error: "SelfPayment" }
  const profile = state.profiles[handle]
  if (profile?.active && !profile.tipsOpen) return { state, error: "TipsClosed" }
  const amount = parseAmount(input.amount || "0")
  if (amount === null) return { state, error: "badAmount" }
  if (input.memo.length > 140) return { state, error: "tooLong" }
  const tip: TipModel = {
    id: state.nextTipId,
    fromAgentId: state.viewerId,
    toAgentId: agentTokenId(handle),
    token: input.token,
    amount,
    from: PREVIEW_ADA,
    to: holderOf(handle),
    timestamp: now(),
    fromHandle: state.viewerHandle,
    toHandle: handle,
    memo: input.memo,
  }
  return { state: { ...state, tips: [tip, ...state.tips], nextTipId: state.nextTipId + 1n } }
}

export function previewBuyPass(state: PreviewState, handle: string): Result {
  const profile = state.profiles[handle] ?? emptyProfile(handle)
  if (!profile.active || !profile.passOpen) return { state, error: "PassClosed" }
  if (handle === state.viewerHandle) return { state, error: "SelfPayment" }
  const pass = makePass(state, state.nextPassId, handle, profile.passLabel || "access", 0n, profile.passToken, profile.passPrice)
  return { state: { ...state, passes: [pass, ...state.passes], nextPassId: state.nextPassId + 1n } }
}

export function previewUsePass(state: PreviewState, id: bigint, action: string): Result {
  if (!action.trim()) return { state, error: "EmptyAction" }
  if (action.length > 32) return { state, error: "tooLong" }
  const found = state.passes.find((item) => item.id === id)
  if (!found) return { state, error: "PassMissing" }
  if (found.holderAgentId !== state.viewerId) return { state, error: "NotPassHolder" }
  return {
    state: {
      ...state,
      passes: state.passes.map((item) =>
        item.id === id ? { ...item, uses: item.uses + 1n, lastAction: action, lastUsedAt: now() } : item,
      ),
    },
  }
}

function makePass(
  state: PreviewState,
  id: bigint,
  issuerHandle: string,
  label: string,
  invoiceId: bigint,
  token: Address,
  price: bigint,
): PassModel {
  return {
    id,
    holderAgentId: state.viewerId,
    issuerAgentId: agentTokenId(issuerHandle),
    invoiceId,
    token,
    price,
    mintedAt: now(),
    uses: 0n,
    lastUsedAt: 0n,
    holderHandle: state.viewerHandle,
    issuerHandle,
    label,
    lastAction: "",
  }
}

type PreviewApi = {
  state: PreviewState
  rejectNext: boolean
  setRejectNext: (value: boolean) => void
  noAgent: boolean
  profileOf: (handle: string) => ProfileModel
  holderOf: (handle: string) => Address
  apply: (result: Result) => string | undefined
}

const PreviewContext = createContext<PreviewApi | null>(null)

export function PreviewProvider({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState(initialState)
  const [rejectNext, setRejectNext] = useState(false)
  const api = useMemo<PreviewApi>(
    () => ({
      state,
      rejectNext,
      setRejectNext,
      noAgent: location.pathname.endsWith("/empty"),
      profileOf: (handle) => state.profiles[handle] ?? emptyProfile(handle),
      holderOf,
      apply: (result) => {
        if (rejectNext) return "rejected"
        if (!result.error) setState(result.state)
        return result.error
      },
    }),
    [location.pathname, rejectNext, state],
  )
  return <PreviewContext.Provider value={api}>{children ?? <Outlet />}</PreviewContext.Provider>
}

export function usePreview() {
  return useContext(PreviewContext)
}
