/// 币安主 App 的 WalletConnect 入口。不是 Agentic Wallet 配对码，也不指向单独的钱包 App。
const BINANCE_WC_PATH = "app.binance.com/cedefi/wc"

export function binanceUniversalLink(uri: string) {
  return `https://${BINANCE_WC_PATH}?uri=${encodeURIComponent(uri)}`
}

export function binanceNativeLink(uri: string) {
  return `bnc://${BINANCE_WC_PATH}?uri=${encodeURIComponent(uri)}`
}

export function isPhoneBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}

type BinanceWindow = Window & {
  ethereum?: { isBinance?: boolean }
  binancew3w?: { ethereum?: unknown }
}

/// 已经在币安 App 内置浏览器里时，页面会注入这个 provider。
export function binanceInjectedProvider(target: BinanceWindow | undefined = typeof window === "undefined" ? undefined : (window as BinanceWindow)) {
  if (!target) return undefined
  if (target.binancew3w?.ethereum) return target.binancew3w.ethereum
  if (target.ethereum?.isBinance) return target.ethereum
  return undefined
}
