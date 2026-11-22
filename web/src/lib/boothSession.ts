import type { CheckoutAsset } from "./checkout.ts"

export type BoothDraft = {
  name: string
  amount: string
  asset: CheckoutAsset
  memo: string
}

function key(preview: boolean) {
  return preview ? "namepay.booth.preview.v1" : "namepay.booth.live.v1"
}

export function parseBoothDraft(raw: string): BoothDraft | null {
  try {
    const value = JSON.parse(raw) as Partial<BoothDraft>
    if (!value || typeof value !== "object") return null
    if (typeof value.name !== "string" || value.name.length > 80) return null
    if (typeof value.amount !== "string" || value.amount.length > 40) return null
    if (value.asset !== "bnb" && value.asset !== "usdc") return null
    if (typeof value.memo !== "string" || value.memo.length > 140) return null
    return { name: value.name, amount: value.amount, asset: value.asset, memo: value.memo }
  } catch {
    return null
  }
}

export function loadBoothDraft(preview: boolean): BoothDraft | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(key(preview))
  if (!raw) return null
  return parseBoothDraft(raw)
}

export function saveBoothDraft(preview: boolean, draft: BoothDraft) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(key(preview), JSON.stringify(draft))
}
