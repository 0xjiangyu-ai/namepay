import { type Address, isAddress } from "viem"
import type { TipModel } from "../models.ts"

type StoredTip = {
  id: string
  fromAgentId: string
  toAgentId: string
  token: Address
  amount: string
  from: Address
  to: Address
  timestamp: string
  fromHandle: string
  toHandle: string
  memo: string
  txHash?: `0x${string}`
}

function key(handle: string) {
  return `namepay.inbox.v1:${handle}`
}

function isHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
}

export function parseInbox(raw: string): TipModel[] {
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    const items: TipModel[] = []
    for (const row of value) {
      if (!row || typeof row !== "object") continue
      const item = row as Partial<StoredTip>
      if (typeof item.id !== "string" || !/^\d+$/.test(item.id)) continue
      if (typeof item.amount !== "string" || !/^\d+$/.test(item.amount)) continue
      if (typeof item.fromAgentId !== "string" || typeof item.toAgentId !== "string") continue
      if (!item.token || !isAddress(item.token) || !item.from || !isAddress(item.from) || !item.to || !isAddress(item.to)) continue
      if (typeof item.timestamp !== "string" || typeof item.fromHandle !== "string" || typeof item.toHandle !== "string") continue
      if (typeof item.memo !== "string") continue
      items.push({
        id: BigInt(item.id),
        fromAgentId: BigInt(item.fromAgentId),
        toAgentId: BigInt(item.toAgentId),
        token: item.token,
        amount: BigInt(item.amount),
        from: item.from,
        to: item.to,
        timestamp: BigInt(item.timestamp),
        fromHandle: item.fromHandle,
        toHandle: item.toHandle,
        memo: item.memo,
        txHash: isHash(item.txHash) ? item.txHash : undefined,
      })
    }
    return items
  } catch {
    return []
  }
}

export function loadInbox(handle: string): TipModel[] {
  if (!handle || typeof localStorage === "undefined") return []
  const raw = localStorage.getItem(key(handle))
  if (!raw) return []
  return parseInbox(raw)
}

export function withTipHashes(items: TipModel[], hashes: Record<string, `0x${string}` | undefined>) {
  return items.map((item) => ({ ...item, txHash: item.txHash ?? hashes[item.id.toString()] }))
}

export function saveInbox(handle: string, items: TipModel[]) {
  if (!handle || typeof localStorage === "undefined") return
  const stored: StoredTip[] = items.map((item) => ({
    id: item.id.toString(),
    fromAgentId: item.fromAgentId.toString(),
    toAgentId: item.toAgentId.toString(),
    token: item.token,
    amount: item.amount.toString(),
    from: item.from,
    to: item.to,
    timestamp: item.timestamp.toString(),
    fromHandle: item.fromHandle,
    toHandle: item.toHandle,
    memo: item.memo,
    txHash: item.txHash,
  }))
  localStorage.setItem(key(handle), JSON.stringify(stored))
}
