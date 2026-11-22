import assert from "node:assert/strict"
import { normalizeHandle } from "./handles.ts"

assert.equal(normalizeHandle("Alice.AI"), "alice")
assert.equal(normalizeHandle("  bob.ai "), "bob")
assert.equal(normalizeHandle("CAROL"), "carol")
assert.equal(normalizeHandle("ada.AI"), "ada")
assert.equal(normalizeHandle(".ai"), "")
assert.equal(normalizeHandle("a.b.ai"), "a.b")
assert.equal(normalizeHandle("\talice.ai\n"), "alice")
console.log("normalize ok")
