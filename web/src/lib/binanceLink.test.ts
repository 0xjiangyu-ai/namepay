import assert from "node:assert/strict"
import { binanceNativeLink, binanceUniversalLink, isPhoneBrowser } from "./binanceLink.ts"

const uri = "wc:abc@2?relay-protocol=irn&symKey=xyz"
assert.equal(
  binanceUniversalLink(uri),
  "https://app.binance.com/cedefi/wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn%26symKey%3Dxyz",
)
assert.equal(
  binanceNativeLink(uri),
  "bnc://app.binance.com/cedefi/wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn%26symKey%3Dxyz",
)
assert.equal(isPhoneBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true)
assert.equal(isPhoneBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 7)"), true)
assert.equal(isPhoneBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), false)

console.log("binance link ok")
