import { keccak256, toBytes, type Address, zeroAddress } from "viem"

/// 与合约 HANDLE_CEILING 一致。已注册的名字是否能收款，仍以 ownerOfHandle 为准。
export function isHandleShape(handle: string) {
  return handle.length > 0 && handle.length <= 64 && /^[a-z0-9]+$/.test(handle)
}

/// 没开过档案的名字可以收款。只有档案开着、并且明确关掉打赏时，tip 才会revert。
export function tipsAreClosed(profile: { active: boolean; tipsOpen: boolean } | null | undefined) {
  return Boolean(profile?.active && !profile.tipsOpen)
}

/// 预览收据上的模拟哈希。写进本地记录后，刷新还是同一串；它不会出现在区块浏览器上。
export function previewReceiptHash(parts: readonly string[]) {
  return keccak256(toBytes(`namepay-preview:${parts.join("|")}`))
}

export const PREVIEW_ADA = "0x1111111111111111111111111111111111111111" as Address
export const PREVIEW_BAO = "0x2222222222222222222222222222222222222222" as Address
export const PREVIEW_SHUT = "0x3333333333333333333333333333333333333333" as Address

/// 离线也能走完的三个样本。其他名字走链上解析。
export function isPreviewFixture(handle: string) {
  return handle === "ada" || handle === "bao" || handle === "tipoff"
}

export function fixtureHolder(handle: string): Address {
  if (handle === "ada") return PREVIEW_ADA
  if (handle === "bao") return PREVIEW_BAO
  if (handle === "tipoff") return PREVIEW_SHUT
  return zeroAddress
}
