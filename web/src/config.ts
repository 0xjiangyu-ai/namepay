import { type Address, isAddress } from "viem"

const fallbackAgent = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"
const fallbackUsdc = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
const fallbackNamepay = "0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD"
const fallbackWalletConnectProjectId = "b15baee6f2adab1a83a7feb4458d58a3"

function addressOr(value: string | undefined, fallback: Address): Address {
  if (value && isAddress(value)) return value
  return fallback
}

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 56)

/** 主网公共读节点，按顺序尝试。自定义 VITE_RPC_URL 会排在最前面。 */
export const BSC_PUBLIC_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed1.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc.publicnode.com",
  "https://1rpc.io/bnb",
] as const

export const RPC_URL = (import.meta.env.VITE_RPC_URL || "").trim()

export function readRpcUrls() {
  const urls = [...BSC_PUBLIC_RPCS]
  if (RPC_URL && !urls.includes(RPC_URL as (typeof BSC_PUBLIC_RPCS)[number])) urls.unshift(RPC_URL)
  return urls
}
export const AGENT_ID = addressOr(import.meta.env.VITE_AGENT_ID_ADDRESS, fallbackAgent)
export const USDC = addressOr(import.meta.env.VITE_USDC_ADDRESS, fallbackUsdc)
export const WALLETCONNECT_PROJECT_ID = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || fallbackWalletConnectProjectId
).trim()

/** BSC 主网已部署的 Namepay。环境变量可覆盖，留空则使用这个地址。 */
export const NAMEPAY: Address | null = addressOr(import.meta.env.VITE_NAMEPAY_ADDRESS, fallbackNamepay)

export const EXPLORER = CHAIN_ID === 56 ? "https://bscscan.com" : ""
