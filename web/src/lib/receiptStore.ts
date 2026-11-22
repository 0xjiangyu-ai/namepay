export type SavedReceipt = {
  hash: `0x${string}`
  handle: string
  amount: string
  asset: "bnb" | "usdc"
  memo: string
  holder: string
  preview: boolean
}

function key(receipt: Pick<SavedReceipt, "preview" | "handle" | "amount" | "asset" | "memo">) {
  return `namepay.receipt.v1:${receipt.preview ? "preview" : "live"}:${receipt.handle}:${receipt.amount}:${receipt.asset}:${receipt.memo}`
}

function isHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
}

export function loadReceipt(receipt: Pick<SavedReceipt, "preview" | "handle" | "amount" | "asset" | "memo">): SavedReceipt | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(key(receipt))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<SavedReceipt>
    if (!isHash(value.hash) || value.handle !== receipt.handle) return null
    if (value.amount !== receipt.amount || value.asset !== receipt.asset || value.memo !== receipt.memo) return null
    if (typeof value.holder !== "string" || typeof value.preview !== "boolean") return null
    return {
      hash: value.hash,
      handle: value.handle,
      amount: value.amount,
      asset: value.asset,
      memo: value.memo,
      holder: value.holder,
      preview: value.preview,
    }
  } catch {
    return null
  }
}

export function saveReceipt(receipt: SavedReceipt) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(key(receipt), JSON.stringify(receipt))
}

export function clearReceipt(receipt: Pick<SavedReceipt, "preview" | "handle" | "amount" | "asset" | "memo">) {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(key(receipt))
}
