import { keccak256, toBytes } from "viem"

function isSpace(char: string) {
  return char === " " || char === "\t" || char === "\n" || char === "\r"
}

/// 与 Namepay.normalizeHandle 保持同一套规则：去首尾空白、去掉一个结尾的 .ai、只把 A-Z 转成小写。
export function normalizeHandle(input: string) {
  let start = 0
  let end = input.length
  while (start < end && isSpace(input[start] ?? "")) start += 1
  while (end > start && isSpace(input[end - 1] ?? "")) end -= 1
  if (end >= start + 3 && input[end - 3] === ".") {
    const mid = input[end - 2] ?? ""
    const last = input[end - 1] ?? ""
    if ((mid === "a" || mid === "A") && (last === "i" || last === "I")) {
      end -= 3
      while (end > start && isSpace(input[end - 1] ?? "")) end -= 1
    }
  }
  let out = ""
  for (let i = start; i < end; i += 1) {
    const code = input.charCodeAt(i)
    out += code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 32) : input[i]
  }
  return out
}

export function displayName(handle: string) {
  if (!handle) return ""
  return handle.endsWith(".ai") ? handle : `${handle}.ai`
}

/// tokenId = uint256(keccak256(bytes(handle)))，handle 不含 .ai。
export function agentTokenId(handle: string) {
  return BigInt(keccak256(toBytes(handle)))
}
