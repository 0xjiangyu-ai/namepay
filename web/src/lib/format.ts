import { type Address, formatUnits, parseUnits, zeroAddress } from "viem"

export function tokenSymbol(token: Address) {
  return token === zeroAddress ? "BNB" : "USDC"
}

export function formatAmount(amount: bigint) {
  const raw = formatUnits(amount, 18)
  if (!raw.includes(".")) return raw
  return raw.replace(/0+$/, "").replace(/\.$/, "")
}

export function formatToken(amount: bigint, token: Address) {
  return `${formatAmount(amount)} ${tokenSymbol(token)}`
}

export function parseAmount(input: string) {
  const trimmed = input.trim()
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) return null
  try {
    return parseUnits(trimmed, 18)
  } catch {
    return null
  }
}

export function shortAddress(address: string) {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatWhen(seconds: bigint, lang: "en" | "zh") {
  if (seconds === 0n) return ""
  const date = new Date(Number(seconds) * 1000)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function deadlineFromLocal(value: string) {
  if (!value) return 0n
  const ms = new Date(value).getTime()
  if (Number.isNaN(ms)) return null
  return BigInt(Math.floor(ms / 1000))
}
