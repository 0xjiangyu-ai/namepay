import assert from "node:assert/strict"
import { absoluteAppUrl, appBasename } from "./publicUrl.ts"

assert.equal(appBasename("/"), undefined)
assert.equal(appBasename(""), undefined)
assert.equal(appBasename("/namepay/"), "/namepay")
assert.equal(appBasename("/namepay"), "/namepay")

assert.equal(absoluteAppUrl("/booth", "https://0xjiangyu-ai.github.io", "/"), "https://0xjiangyu-ai.github.io/booth")
assert.equal(
  absoluteAppUrl("/preview/booth", "https://0xjiangyu-ai.github.io", "/namepay/"),
  "https://0xjiangyu-ai.github.io/namepay/preview/booth",
)
assert.equal(
  absoluteAppUrl("/checkout/bao.ai?amount=0.05&token=bnb&memo=desk", "https://0xjiangyu-ai.github.io", "/namepay/"),
  "https://0xjiangyu-ai.github.io/namepay/checkout/bao.ai?amount=0.05&token=bnb&memo=desk",
)

console.log("public url ok")
