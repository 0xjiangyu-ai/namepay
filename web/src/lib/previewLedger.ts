import { type Address, zeroAddress } from "viem"
import { USDC } from "../config.ts"
import type { InvoiceInput, InvoiceModel, PassModel, ProfileInput, ProfileModel, TipInput, TipModel } from "../models.ts"
import { parseAmount } from "./format.ts"
import { agentTokenId } from "./handles.ts"
import { fixtureHolder, isHandleShape, isPreviewFixture, PREVIEW_ADA, previewReceiptHash } from "./payeeRules.ts"

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

export type PreviewResult = { state: PreviewState; error?: string; hash?: `0x${string}` }

export type PreviewTipGate = {
  /// 链上已经解析到持有人。样本名字以外必须带上。
  resolved?: boolean
  tipsClosed?: boolean
  holder?: Address
}

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

/// 未注册的样本，用来走“打赏已关闭”。已注册的名字以链上档案为准，不用这个名字占位。
const tipoffProfile: ProfileModel = {
  active: true,
  tipsOpen: false,
  passOpen: false,
  passToken: zeroAddress,
  passPrice: 0n,
  handle: "tipoff",
  bio: "Tips are closed on this sample name.",
  passLabel: "",
}

const initialProfiles: Record<string, ProfileModel> = { bao: baoProfile, tipoff: tipoffProfile }

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

export const initialPreviewState: PreviewState = {
  viewerHandle: "ada",
  viewerId: adaId,
  profiles: initialProfiles,
  invoices: initialInvoices,
  tips: [],
  passes: [],
  nextInvoiceId: 3n,
  nextTipId: 1n,
  nextPassId: 1n,
}

export function previewProfileOf(state: PreviewState, handle: string) {
  return state.profiles[handle] ?? emptyProfile(handle)
}

export function previewProfile(state: PreviewState, input: ProfileInput): PreviewResult {
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

export function previewInvoice(state: PreviewState, input: InvoiceInput): PreviewResult {
  const amount = parseAmount(input.amount || "0")
  if (amount === null) return { state, error: "badAmount" }
  if (input.memo.length > 140 || input.passLabel.length > 48) return { state, error: "tooLong" }
  if (input.onlyName && !input.restricted.trim()) return { state, error: "needName" }
  let restrictedId = 0n
  let restrictedHandle = ""
  if (input.onlyName) {
    restrictedHandle = input.restricted.trim().toLowerCase().replace(/\.ai$/, "")
    if (!isPreviewFixture(restrictedHandle)) return { state, error: "UnknownHandle" }
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

export function previewCancel(state: PreviewState, id: bigint): PreviewResult {
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

export function previewPay(state: PreviewState, id: bigint): PreviewResult {
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
  const hash = previewReceiptHash(["invoice", id.toString(), state.viewerHandle, found.amount.toString()])
  return {
    hash,
    state: {
      ...state,
      nextPassId,
      passes,
      invoices: state.invoices.map((item) =>
        item.id === id
          ? { ...item, paid: true, payerAgentId: state.viewerId, paidTo: fixtureHolder(item.handle), paidAt: now() }
          : item,
      ),
    },
  }
}

export function previewTip(state: PreviewState, handle: string, input: TipInput, gate?: PreviewTipGate): PreviewResult {
  if (!isHandleShape(handle)) return { state, error: "InvalidHandle" }
  if (!isPreviewFixture(handle) && !gate?.resolved) return { state, error: "UnknownHandle" }
  if (handle === state.viewerHandle) return { state, error: "SelfPayment" }
  const profile = state.profiles[handle]
  if (gate?.tipsClosed || (profile?.active && !profile.tipsOpen)) return { state, error: "TipsClosed" }
  const amount = parseAmount(input.amount || "0")
  if (amount === null) return { state, error: "badAmount" }
  if (input.memo.length > 140) return { state, error: "tooLong" }
  const holder = gate?.holder && gate.holder !== zeroAddress ? gate.holder : fixtureHolder(handle)
  if (holder === zeroAddress) return { state, error: "UnknownHandle" }
  const id = state.nextTipId
  const hash = previewReceiptHash([id.toString(), handle, input.token, amount.toString(), input.memo])
  const tip: TipModel = {
    id,
    fromAgentId: state.viewerId,
    toAgentId: agentTokenId(handle),
    token: input.token,
    amount,
    from: PREVIEW_ADA,
    to: holder,
    timestamp: now(),
    fromHandle: state.viewerHandle,
    toHandle: handle,
    memo: input.memo,
    txHash: hash,
  }
  return { state: { ...state, tips: [tip, ...state.tips], nextTipId: id + 1n }, hash }
}

export function previewBuyPass(state: PreviewState, handle: string): PreviewResult {
  const profile = state.profiles[handle] ?? emptyProfile(handle)
  if (!profile.active || !profile.passOpen) return { state, error: "PassClosed" }
  if (handle === state.viewerHandle) return { state, error: "SelfPayment" }
  const pass = makePass(state, state.nextPassId, handle, profile.passLabel || "access", 0n, profile.passToken, profile.passPrice)
  const hash = previewReceiptHash(["pass", state.nextPassId.toString(), handle])
  return { state: { ...state, passes: [pass, ...state.passes], nextPassId: state.nextPassId + 1n }, hash }
}

export function previewUsePass(state: PreviewState, id: bigint, action: string): PreviewResult {
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

const PREVIEW_STATE_KEY = "namepay.preview.v1"

function reviveBigInts(_key: string, value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { $bigint?: unknown }).$bigint === "string" &&
    /^-?\d+$/.test((value as { $bigint: string }).$bigint)
  ) {
    return BigInt((value as { $bigint: string }).$bigint)
  }
  return value
}

function bump(current: bigint, ids: bigint[]) {
  const max = ids.reduce((highest, id) => (id > highest ? id : highest), 0n)
  return current > max ? current : max + 1n
}

/// 把预览账本写进 localStorage。展台和付款页不在同一个标签时，靠 storage 事件同步。
export function serializePreviewState(state: PreviewState) {
  return JSON.stringify(state, (_key, value) => (typeof value === "bigint" ? { $bigint: value.toString() } : value))
}

export function parsePreviewState(raw: string): PreviewState | null {
  try {
    const value = JSON.parse(raw, reviveBigInts) as PreviewState
    if (!value || value.viewerHandle !== "ada" || typeof value.viewerId !== "bigint") return null
    if (!Array.isArray(value.invoices) || !Array.isArray(value.tips) || !Array.isArray(value.passes)) return null
    if (!value.profiles || typeof value.profiles !== "object") return null
    return {
      ...value,
      profiles: { ...initialProfiles, ...value.profiles },
      nextInvoiceId: bump(value.nextInvoiceId, value.invoices.map((item) => item.id)),
      nextTipId: bump(value.nextTipId, value.tips.map((item) => item.id)),
      nextPassId: bump(value.nextPassId, value.passes.map((item) => item.id)),
    }
  } catch {
    return null
  }
}

export function loadPreviewState() {
  if (typeof localStorage === "undefined") return initialPreviewState
  const raw = localStorage.getItem(PREVIEW_STATE_KEY)
  if (!raw) return initialPreviewState
  return parsePreviewState(raw) ?? initialPreviewState
}

export function savePreviewState(state: PreviewState) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(PREVIEW_STATE_KEY, serializePreviewState(state))
}

export { PREVIEW_STATE_KEY }
