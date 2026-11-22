import type { Address } from "viem"

export type TxState = {
  phase: "idle" | "wallet" | "pending" | "success" | "error"
  message: string
  hash?: `0x${string}`
}

export const idleTx: TxState = { phase: "idle", message: "" }

export type IdentityModel = {
  status: "loading" | "disconnected" | "wrong-network" | "error" | "no-agent" | "ready"
  address?: Address
  handle?: string
  tokenId?: bigint
  error?: string
}

export type ProfileModel = {
  active: boolean
  tipsOpen: boolean
  passOpen: boolean
  passToken: Address
  passPrice: bigint
  handle: string
  bio: string
  passLabel: string
}

export type InvoiceModel = {
  id: bigint
  recipientAgentId: bigint
  token: Address
  amount: bigint
  deadline: bigint
  restrictedPayerAgentId: bigint
  mintPass: boolean
  paid: boolean
  cancelled: boolean
  payerAgentId: bigint
  paidTo: Address
  paidAt: bigint
  handle: string
  memo: string
  passLabel: string
  restrictedPayerHandle: string
}

export type TipModel = {
  id: bigint
  fromAgentId: bigint
  toAgentId: bigint
  token: Address
  amount: bigint
  from: Address
  to: Address
  timestamp: bigint
  fromHandle: string
  toHandle: string
  memo: string
}

export type PassModel = {
  id: bigint
  holderAgentId: bigint
  issuerAgentId: bigint
  invoiceId: bigint
  token: Address
  price: bigint
  mintedAt: bigint
  uses: bigint
  lastUsedAt: bigint
  holderHandle: string
  issuerHandle: string
  label: string
  lastAction: string
}

export type ProfileInput = {
  bio: string
  tipsOpen: boolean
  passOpen: boolean
  passToken: Address
  passPrice: string
  passLabel: string
}

export type InvoiceInput = {
  token: Address
  amount: string
  deadline: string
  restricted: string
  onlyName: boolean
  mintPass: boolean
  memo: string
  passLabel: string
}

export type TipInput = {
  token: Address
  amount: string
  memo: string
}
