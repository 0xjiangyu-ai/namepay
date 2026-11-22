import { zeroAddress, type Address } from "viem"
import { USDC } from "../config.ts"

export type CheckoutAsset = "bnb" | "usdc"

export type CheckoutRequest = {
  handle: string
  amount: string
  asset: CheckoutAsset
  memo: string
}

export function checkoutToken(asset: CheckoutAsset): Address {
  return asset === "usdc" ? USDC : zeroAddress
}

export function checkoutPath(basePath: string, request: CheckoutRequest) {
  const params = new URLSearchParams({
    amount: request.amount,
    token: request.asset,
    memo: request.memo,
  })
  const name = request.handle.endsWith(".ai") ? request.handle : `${request.handle}.ai`
  return `${basePath}/checkout/${encodeURIComponent(name)}?${params.toString()}`
}

export function readCheckoutQuery(params: URLSearchParams): { amount: string; asset: CheckoutAsset; memo: string } | null {
  const amount = (params.get("amount") || "").trim()
  const token = (params.get("token") || "").toLowerCase()
  const memo = params.get("memo") || ""
  if (!/^\d+(\.\d{1,18})?$/.test(amount) || Number(amount) <= 0) return null
  if (token !== "bnb" && token !== "usdc") return null
  return { amount, asset: token, memo }
}
