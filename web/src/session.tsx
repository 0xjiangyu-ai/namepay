import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { type Address, zeroAddress } from "viem"
import { useChainId, useConnection, useReadContract, useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { agentAbi } from "./abi/agentId.ts"
import { erc20Abi } from "./abi/erc20.ts"
import { namepayAbi } from "./abi/namepay.ts"
import { wagmiConfig } from "./chain.ts"
import { AGENT_ID, CHAIN_ID, NAMEPAY, USDC } from "./config.ts"
import { useI18n } from "./i18n.tsx"
import { explainError } from "./lib/errors.ts"
import { deadlineFromLocal, parseAmount } from "./lib/format.ts"
import { agentTokenId, normalizeHandle } from "./lib/handles.ts"
import {
  idleTx,
  type IdentityModel,
  type InvoiceInput,
  type InvoiceModel,
  type PassModel,
  type ProfileInput,
  type ProfileModel,
  type TipInput,
  type TipModel,
  type TxState,
} from "./models.ts"
import {
  previewBuyPass,
  previewCancel,
  previewInvoice,
  previewPay,
  previewProfile,
  previewTip,
  previewUsePass,
  usePreview,
} from "./preview.tsx"

function localMessage(code: string, copy: ReturnType<typeof useI18n>["copy"]) {
  if (code === "rejected") return copy.txRejected
  if (code === "badAmount") return copy.badAmount
  if (code === "tooLong") return copy.tooLong
  if (code === "needName") return copy.needName
  if (code === "badDeadline") return copy.badDeadline
  if (code in copy.errors) return copy.errors[code as keyof typeof copy.errors]
  return copy.txError
}

export function useIdentity(): IdentityModel & { reload: () => void } {
  const preview = usePreview()
  const { copy } = useI18n()
  const { address, isConnected, isConnecting, isReconnecting } = useConnection()
  const walletChainId = useChainId()
  const balance = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !preview && Boolean(address) },
  })
  const holds = (balance.data ?? 0n) > 0n
  const handleRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "handleOf",
    args: address ? [address] : undefined,
    query: { enabled: !preview && Boolean(address) && holds },
  })
  const handle = handleRead.data || ""
  const tokenId = handle ? agentTokenId(handle) : undefined
  const ownerRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: !preview && tokenId !== undefined },
  })
  const reload = () => {
    void balance.refetch()
    void handleRead.refetch()
    void ownerRead.refetch()
  }

  if (preview) {
    if (preview.noAgent) return { status: "no-agent", address: preview.state.viewerId ? undefined : undefined, reload }
    return {
      status: "ready",
      address: "0x1111111111111111111111111111111111111111",
      handle: preview.state.viewerHandle,
      tokenId: preview.state.viewerId,
      reload,
    }
  }

  if (isConnecting || isReconnecting) return { status: "loading", reload }
  if (!isConnected || !address) return { status: "disconnected", reload }
  const knownHandle = handle || undefined
  if (walletChainId !== CHAIN_ID) {
    return { status: "wrong-network", address, handle: knownHandle, tokenId, reload }
  }
  const waiting =
    balance.isLoading || (holds && handleRead.isLoading) || (Boolean(handle) && ownerRead.isLoading)
  if (waiting) return { status: "loading", address, reload }
  if (balance.isError || handleRead.isError || ownerRead.isError) {
    return { status: "error", address, error: copy.rpcError, reload }
  }
  if (!holds || !handle || tokenId === undefined) return { status: "no-agent", address, reload }
  if (ownerRead.data && ownerRead.data.toLowerCase() !== address.toLowerCase()) {
    return { status: "error", address, error: copy.errors.AgentIdMismatch, reload }
  }
  return { status: "ready", address, handle, tokenId, reload }
}

function useBundle(tokenId: bigint | undefined, enabled: boolean) {
  const listArgs = tokenId !== undefined ? ([tokenId, 0n, 20n] as const) : undefined
  const ready = enabled && tokenId !== undefined && Boolean(NAMEPAY)
  const created = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "recipientInvoiceIds",
    args: listArgs,
    query: { enabled: ready },
  })
  const paidIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "payerInvoiceIds",
    args: listArgs,
    query: { enabled: ready },
  })
  const sentIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "sentTipIds",
    args: listArgs,
    query: { enabled: ready },
  })
  const receivedIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "receivedTipIds",
    args: listArgs,
    query: { enabled: ready },
  })
  const passIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "passIdsOf",
    args: listArgs,
    query: { enabled: ready },
  })
  const profileRead = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "profile",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: ready },
  })

  const invoices = useDetails<InvoiceModel>(created.data, "invoice", ready)
  const paid = useDetails<InvoiceModel>(paidIds.data, "invoice", ready)
  const tipsSent = useDetails<TipModel>(sentIds.data, "tipInfo", ready)
  const tipsReceived = useDetails<TipModel>(receivedIds.data, "tipInfo", ready)
  const passes = useDetails<PassModel>(passIds.data, "passInfo", ready)
  const loading =
    created.isLoading || paidIds.isLoading || sentIds.isLoading || receivedIds.isLoading || passIds.isLoading || profileRead.isLoading || invoices.loading || paid.loading || tipsSent.loading || tipsReceived.loading || passes.loading

  return {
    profile: profileRead.data ? toProfile(profileRead.data) : null,
    invoices: invoices.items,
    paid: paid.items,
    tipsSent: tipsSent.items,
    tipsReceived: tipsReceived.items,
    passes: passes.items,
    loading,
  }
}

function useDetails<T>(ids: readonly bigint[] | undefined, itemName: "invoice" | "tipInfo" | "passInfo", enabled: boolean) {
  const list = ids ?? []
  const details = useReadContracts({
    contracts: list.map((id) => ({
      address: NAMEPAY ?? zeroAddress,
      abi: namepayAbi,
      functionName: itemName,
      args: [id] as const,
    })),
    query: { enabled: enabled && list.length > 0 },
  })
  const items = (details.data ?? [])
    .map((row) => (row.status === "success" ? (row.result as T) : null))
    .filter((row): row is T => row !== null)
  return { items, loading: details.isLoading }
}

function toProfile(
  value: readonly [boolean, boolean, boolean, Address, bigint, string, string, string],
): ProfileModel {
  const [active, tipsOpen, passOpen, passToken, passPrice, handle, bio, passLabel] = value
  return { active, tipsOpen, passOpen, passToken, passPrice, handle, bio, passLabel }
}

export function useBasePath() {
  return usePreview() ? "/preview" : ""
}

export function useDesk() {
  const preview = usePreview()
  const identity = useIdentity()
  const { copy } = useI18n()
  const [tx, setTx] = useState<TxState>(idleTx)
  const bundle = useBundle(identity.tokenId, !preview && identity.status === "ready")
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()

  async function send(success: string, write: () => Promise<`0x${string}`>) {
    if (!NAMEPAY) {
      setTx({ phase: "error", message: copy.notDeployedAction })
      return
    }
    setTx({ phase: "wallet", message: copy.txWallet })
    try {
      const hash = await write()
      setTx({ phase: "pending", message: copy.txPending, hash })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: success, hash })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  const onProfile = async (input: ProfileInput) => {
    if (input.bio.length > 140 || input.passLabel.length > 48) {
      setTx({ phase: "error", message: copy.tooLong })
      return
    }
    const price = input.passOpen ? parseAmount(input.passPrice || "0") : 0n
    if (price === null) {
      setTx({ phase: "error", message: copy.badAmount })
      return
    }
    if (preview) {
      const code = preview.apply(previewProfile(preview.state, input))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    await send(copy.txSuccess, () =>
      writeContractAsync({
        address: NAMEPAY!,
        abi: namepayAbi,
        functionName: "setProfile",
        args: [input.bio, input.tipsOpen, input.passOpen, input.passOpen ? input.passToken : zeroAddress, price, input.passLabel],
      }),
    )
  }

  const onInvoice = async (input: InvoiceInput) => {
    const amount = parseAmount(input.amount || "0")
    if (amount === null) {
      setTx({ phase: "error", message: copy.badAmount })
      return
    }
    if (input.memo.length > 140 || input.passLabel.length > 48) {
      setTx({ phase: "error", message: copy.tooLong })
      return
    }
    if (input.onlyName && !input.restricted.trim()) {
      setTx({ phase: "error", message: copy.needName })
      return
    }
    const deadline = deadlineFromLocal(input.deadline)
    if (deadline === null) {
      setTx({ phase: "error", message: copy.badDeadline })
      return
    }
    if (preview) {
      const code = preview.apply(previewInvoice(preview.state, input))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    await send(copy.txSuccess, () =>
      writeContractAsync({
        address: NAMEPAY!,
        abi: namepayAbi,
        functionName: "createInvoice",
        args: [input.token, amount, deadline, input.onlyName ? input.restricted : "", input.mintPass, input.memo, input.passLabel],
      }),
    )
  }

  const onCancel = async (id: bigint) => {
    if (preview) {
      const code = preview.apply(previewCancel(preview.state, id))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    await send(copy.txSuccess, () =>
      writeContractAsync({ address: NAMEPAY!, abi: namepayAbi, functionName: "cancelInvoice", args: [id] }),
    )
  }

  const onUsePass = async (id: bigint, action: string) => {
    if (!action.trim()) {
      setTx({ phase: "error", message: copy.needAction })
      return
    }
    if (preview) {
      const code = preview.apply(previewUsePass(preview.state, id, action))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    await send(copy.txSuccess, () =>
      writeContractAsync({ address: NAMEPAY!, abi: namepayAbi, functionName: "usePass", args: [id, action] }),
    )
  }

  const previewDesk = useMemo(() => {
    if (!preview) return null
    const handle = preview.state.viewerHandle
    const profile = preview.profileOf(handle)
    const invoices = preview.state.invoices.filter((item) => item.handle === handle)
    const paid = preview.state.invoices.filter((item) => item.paid && item.payerAgentId === preview.state.viewerId)
    return { profile: profile.active ? profile : { ...profile, active: false }, invoices, paid }
  }, [preview])

  return {
    configured: Boolean(preview) || Boolean(NAMEPAY),
    identity,
    profile: previewDesk ? previewDesk.profile : bundle.profile,
    invoices: previewDesk ? previewDesk.invoices : bundle.invoices,
    paid: previewDesk ? previewDesk.paid : bundle.paid,
    tipsSent: preview ? preview.state.tips.filter((item) => item.fromHandle === preview.state.viewerHandle) : bundle.tipsSent,
    tipsReceived: preview ? preview.state.tips.filter((item) => item.toHandle === preview.state.viewerHandle) : bundle.tipsReceived,
    passes: preview ? preview.state.passes : bundle.passes,
    listsLoading: preview ? false : bundle.loading,
    tx,
    clearTx: () => setTx(idleTx),
    onProfile,
    onInvoice,
    onCancel,
    onUsePass,
    basePath: preview ? "/preview" : "",
  }
}

export function usePay(rawId: string | undefined) {
  const valid = Boolean(rawId && /^\d+$/.test(rawId))
  const id = valid ? BigInt(rawId!) : null
  const preview = usePreview()
  const identity = useIdentity()
  const { copy } = useI18n()
  const [tx, setTx] = useState<TxState>(idleTx)
  const read = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "invoice",
    args: id !== null ? [id] : undefined,
    query: { enabled: !preview && id !== null && Boolean(NAMEPAY) },
  })
  const invoice = preview
    ? (preview.state.invoices.find((item) => item.id === id) ?? null)
    : read.data
      ? (read.data as InvoiceModel)
      : null
  const holderRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "ownerOfHandle",
    args: invoice ? [invoice.handle] : undefined,
    query: { enabled: !preview && Boolean(invoice?.handle) },
  })
  const allowance = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: identity.address && NAMEPAY ? [identity.address, NAMEPAY] : undefined,
    query: {
      enabled: !preview && Boolean(identity.address && NAMEPAY && invoice && invoice.token !== zeroAddress && invoice.amount > 0n),
    },
  })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const needsApproval = Boolean(
    !preview && invoice && invoice.token !== zeroAddress && invoice.amount > 0n && (allowance.data ?? 0n) < invoice.amount,
  )

  async function approve() {
    if (!invoice || !NAMEPAY) return
    setTx({ phase: "wallet", message: copy.txWallet })
    try {
      const hash = await writeContractAsync({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [NAMEPAY, invoice.amount],
      })
      setTx({ phase: "pending", message: copy.txPending, hash })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: copy.thenPay, hash })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  async function pay() {
    if (!invoice) return
    if (preview) {
      const code = preview.apply(previewPay(preview.state, invoice.id))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    if (!NAMEPAY) {
      setTx({ phase: "error", message: copy.notDeployedAction })
      return
    }
    setTx({ phase: "wallet", message: copy.txWallet })
    try {
      const hash = await writeContractAsync({
        address: NAMEPAY,
        abi: namepayAbi,
        functionName: "payInvoice",
        args: [invoice.id],
        value: invoice.token === zeroAddress ? invoice.amount : 0n,
      })
      setTx({ phase: "pending", message: copy.txPending, hash })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: copy.txSuccess, hash })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  return {
    invalid: !valid,
    missing: valid && !preview && Boolean(NAMEPAY) && read.isError,
    missingConfig: valid && !preview && !NAMEPAY,
    loading: !preview && valid && Boolean(NAMEPAY) && read.isLoading,
    invoice,
    holder: preview ? preview.holderOf(invoice?.handle ?? "") : holderRead.data,
    identity,
    needsApproval,
    tx,
    approve,
    pay,
    clearTx: () => setTx(idleTx),
    basePath: preview ? "/preview" : "",
    copy,
  }
}

export function usePayee(rawName: string) {
  const preview = usePreview()
  const identity = useIdentity()
  const { copy } = useI18n()
  const [tx, setTx] = useState<TxState>(idleTx)
  const normalized = normalizeHandle(decodeURIComponent(rawName))
  const ownerRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "ownerOfHandle",
    args: [normalized],
    query: { enabled: !preview && normalized.length > 0 },
  })
  const validRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "isValidHandle",
    args: [normalized],
    query: { enabled: !preview && ownerRead.data === zeroAddress },
  })
  const knownPreview = normalized === "ada" || normalized === "bao"
  const tokenId = normalized ? agentTokenId(normalized) : undefined
  const profileRead = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "profile",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: !preview && Boolean(NAMEPAY) && knownOrLive(ownerRead.data) },
  })
  const invoiceIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "recipientInvoiceIds",
    args: tokenId !== undefined ? [tokenId, 0n, 20n] : undefined,
    query: { enabled: !preview && Boolean(NAMEPAY) && knownOrLive(ownerRead.data) },
  })
  const details = useDetails<InvoiceModel>(invoiceIds.data, "invoice", !preview && Boolean(NAMEPAY))
  const allowance = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: identity.address && NAMEPAY ? [identity.address, NAMEPAY] : undefined,
    query: { enabled: !preview && Boolean(identity.address && NAMEPAY) },
  })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()

  let status: "loading" | "invalid" | "unknown" | "ready" = "loading"
  if (!normalized) status = "invalid"
  else if (preview) status = knownPreview ? "ready" : normalized.length < 3 || /[^a-z0-9]/.test(normalized) ? "invalid" : "unknown"
  else if (ownerRead.isLoading || (ownerRead.data === zeroAddress && validRead.isLoading)) status = "loading"
  else if (ownerRead.isError) status = "unknown"
  else if (ownerRead.data && ownerRead.data !== zeroAddress) status = "ready"
  else if (validRead.data === false) status = "invalid"
  else status = "unknown"

  const profile = preview
    ? preview.profileOf(normalized)
    : profileRead.data
      ? toProfile(profileRead.data)
      : null
  const invoices = (
    preview ? preview.state.invoices.filter((item) => item.handle === normalized) : details.items
  ).filter((item) => !item.paid && !item.cancelled)

  async function send(success: string, write: () => Promise<`0x${string}`>) {
    if (!NAMEPAY) {
      setTx({ phase: "error", message: copy.notDeployedAction })
      return
    }
    setTx({ phase: "wallet", message: copy.txWallet })
    try {
      const hash = await write()
      setTx({ phase: "pending", message: copy.txPending, hash })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: success, hash })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  const approve = async (amount: bigint) => {
    if (!NAMEPAY || amount === 0n) return
    setTx({ phase: "wallet", message: copy.txWallet })
    try {
      const hash = await writeContractAsync({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [NAMEPAY, amount],
      })
      setTx({ phase: "pending", message: copy.txPending, hash })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: copy.thenPay, hash })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  const tip = async (input: TipInput) => {
    const amount = parseAmount(input.amount || "0")
    if (amount === null) {
      setTx({ phase: "error", message: copy.badAmount })
      return
    }
    if (preview) {
      const code = preview.apply(previewTip(preview.state, normalized, input))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    await send(copy.txSuccess, () =>
      input.token === zeroAddress
        ? writeContractAsync({
            address: NAMEPAY!,
            abi: namepayAbi,
            functionName: "tip",
            args: [rawName, input.memo],
            value: amount,
          })
        : writeContractAsync({
            address: NAMEPAY!,
            abi: namepayAbi,
            functionName: "tipToken",
            args: [rawName, amount, input.memo],
          }),
    )
  }

  const buy = async () => {
    if (preview) {
      const code = preview.apply(previewBuyPass(preview.state, normalized))
      setTx(code ? { phase: "error", message: localMessage(code, copy) } : { phase: "success", message: copy.txSuccess })
      return
    }
    const price = profile?.passPrice ?? 0n
    const token = profile?.passToken ?? zeroAddress
    await send(copy.txSuccess, () =>
      writeContractAsync({
        address: NAMEPAY!,
        abi: namepayAbi,
        functionName: "buyPass",
        args: [rawName],
        value: token === zeroAddress ? price : 0n,
      }),
    )
  }

  return {
    normalized,
    status,
    holder: preview ? preview.holderOf(normalized) : ownerRead.data,
    profile,
    invoices,
    loading: status === "loading" || (!preview && details.loading),
    identity,
    tx,
    live: !preview,
    allowance: allowance.data ?? 0n,
    approve,
    tip,
    buy,
    clearTx: () => setTx(idleTx),
    configured: Boolean(preview) || Boolean(NAMEPAY),
    basePath: preview ? "/preview" : "",
    copy,
  }
}

function knownOrLive(owner: Address | undefined) {
  return Boolean(owner && owner !== zeroAddress)
}

export function useIncomingTips(handle: string) {
  const preview = usePreview()
  const normalized = normalizeHandle(handle)
  const tokenId = normalized ? agentTokenId(normalized) : undefined
  const ids = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "receivedTipIds",
    args: tokenId !== undefined ? [tokenId, 0n, 20n] : undefined,
    query: {
      enabled: !preview && Boolean(NAMEPAY) && Boolean(normalized),
      refetchInterval: 8_000,
    },
  })
  const details = useDetails<TipModel>(ids.data, "tipInfo", !preview && Boolean(NAMEPAY))
  const items = preview ? preview.state.tips.filter((item) => item.toHandle === normalized) : details.items
  return { items, loading: !preview && (ids.isLoading || details.loading) }
}

export function useRegistryLabel() {
  const name = useReadContract({ address: AGENT_ID, abi: agentAbi, functionName: "name" })
  const symbol = useReadContract({ address: AGENT_ID, abi: agentAbi, functionName: "symbol" })
  return {
    name: name.data,
    symbol: symbol.data,
    loading: name.isLoading || symbol.isLoading,
    error: name.isError || symbol.isError,
  }
}
