import assert from "node:assert/strict"
import { zeroAddress } from "viem"
import { parseBoothDraft } from "./boothSession.ts"
import { parseInbox } from "./inboxCache.ts"
import { isHandleShape, isPreviewFixture, previewReceiptHash, tipsAreClosed } from "./payeeRules.ts"
import { initialPreviewState, parsePreviewState, previewTip, serializePreviewState } from "./previewLedger.ts"

assert.equal(isHandleShape("bao"), true)
assert.equal(isHandleShape("zap"), true)
assert.equal(isHandleShape(""), false)
assert.equal(isHandleShape("nope!"), false)
assert.equal(isHandleShape("a".repeat(65)), false)
assert.equal(isPreviewFixture("tipoff"), true)
assert.equal(isPreviewFixture("zap"), false)

assert.equal(tipsAreClosed(null), false)
assert.equal(tipsAreClosed({ active: false, tipsOpen: false }), false)
assert.equal(tipsAreClosed({ active: true, tipsOpen: true }), false)
assert.equal(tipsAreClosed({ active: true, tipsOpen: false }), true)

const bao = previewTip(initialPreviewState, "bao", { token: zeroAddress, amount: "0.05", memo: "booth" })
assert.equal(bao.error, undefined)
assert.equal(bao.hash?.length, 66)
assert.equal(bao.state.tips[0]?.txHash, bao.hash)
assert.equal(bao.state.tips[0]?.toHandle, "bao")

const shut = previewTip(initialPreviewState, "tipoff", { token: zeroAddress, amount: "0.05", memo: "closed" })
assert.equal(shut.error, "TipsClosed")
assert.equal(shut.state.tips.length, 0)

const unresolved = previewTip(initialPreviewState, "zap", { token: zeroAddress, amount: "0.05", memo: "live" })
assert.equal(unresolved.error, "UnknownHandle")

const holder = "0x4444444444444444444444444444444444444444"
const resolved = previewTip(initialPreviewState, "zap", { token: zeroAddress, amount: "1", memo: "desk" }, {
  resolved: true,
  holder,
})
assert.equal(resolved.error, undefined)
assert.equal(resolved.state.tips[0]?.to, holder)
assert.notEqual(resolved.hash, bao.hash)

const closedOnChain = previewTip(initialPreviewState, "zap", { token: zeroAddress, amount: "1", memo: "no" }, {
  resolved: true,
  tipsClosed: true,
  holder,
})
assert.equal(closedOnChain.error, "TipsClosed")

assert.equal(previewTip(initialPreviewState, "nope!", { token: zeroAddress, amount: "1", memo: "" }).error, "InvalidHandle")
assert.equal(previewReceiptHash(["1", "bao"]), previewReceiptHash(["1", "bao"]))

const raw = serializePreviewState(bao.state)
const restored = parsePreviewState(raw)
assert.ok(restored)
assert.equal(restored?.tips[0]?.id, 1n)
assert.equal(restored?.tips[0]?.txHash, bao.hash)
assert.equal(restored?.profiles.tipoff?.tipsOpen, false)
assert.equal(restored?.nextTipId, 2n)

assert.deepEqual(parseBoothDraft(JSON.stringify({ name: "zap.ai", amount: "0.05", asset: "usdc", memo: "desk" })), {
  name: "zap.ai",
  amount: "0.05",
  asset: "usdc",
  memo: "desk",
})
assert.equal(parseBoothDraft("{"), null)
assert.equal(parseBoothDraft(JSON.stringify({ name: "zap.ai", amount: "1", asset: "dai", memo: "" })), null)

const inbox = parseInbox(
  JSON.stringify([
    {
      id: "7",
      fromAgentId: "1",
      toAgentId: "2",
      token: zeroAddress,
      amount: "50000000000000000",
      from: holder,
      to: holder,
      timestamp: "1700000000",
      fromHandle: "ada",
      toHandle: "zap",
      memo: "booth",
      txHash: bao.hash,
    },
  ]),
)
assert.equal(inbox.length, 1)
assert.equal(inbox[0]?.txHash, bao.hash)
assert.equal(inbox[0]?.amount, 50000000000000000n)
assert.equal(parseInbox("[]").length, 0)

console.log("payee rules ok")
