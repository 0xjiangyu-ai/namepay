import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem"
import type { Copy } from "../i18n.tsx"

export function explainError(error: unknown, copy: Copy) {
  if (error instanceof BaseError) {
    const reverted = error.walk((item) => item instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      if (name && name in copy.errors) return copy.errors[name as keyof Copy["errors"]]
    }
    if (error.walk((item) => item instanceof UserRejectedRequestError)) return copy.txRejected
    return error.shortMessage || copy.txError
  }
  if (error instanceof Error && /reject/i.test(error.message)) return copy.txRejected
  return copy.txError
}
