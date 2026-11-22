import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { type Address, parseAbiItem, zeroAddress } from "viem"
import { useChainId, useConnection, useReadContract, useReadContracts, useWatchContractEvent, useWriteContract } from "wagmi"
import { getPublicClient, waitForTransactionReceipt } from "wagmi/actions"
import { agentAbi } from "./abi/agentId.ts"
import { erc20Abi } from "./abi/erc20.ts"
import { namepayAbi } from "./abi/namepay.ts"
import { wagmiConfig } from "./chain.ts"
import { AGENT_ID, CHAIN_ID, NAMEPAY, USDC } from "./config.ts"
import { useI18n } from "./i18n.tsx"
import { explainError } from "./lib/errors.ts"
import { deadlineFromLocal, parseAmount } from "./lib/format.ts"
import { loadInbox, saveInbox, withTipHashes } from "./lib/inboxCache.ts"
import { agentTokenId, normalizeHandle } from "./lib/handles.ts"
import { isHandleShape, isPreviewFixture, tipsAreClosed } from "./lib/payeeRules.ts"
import {
  previewBuyPass,
  previewCancel,
  previewInvoice,
  previewPay,
  previewProfile,
  previewTip,
  previewUsePass,
} from "./lib/previewLedger.ts"
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
import { usePreview } from "./preview.tsx"

function previewTx(
  outcome: { error?: string; hash?: `0x${string}` },
  copy: ReturnType<typeof useI18n>["copy"],
  success: string,
): TxState {
  if (outcome.error) return { phase: "error", message: localMessage(outcome.error, copy) }
  return { phase: "success", message: success, hash: outcome.hash, purpose: "payment" }
}

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
  return {
    items,
    loading: details.isLoading,
    error: details.isError,
    ready: !enabled || list.length === 0 || details.isSuccess,
    refetch: () => details.refetch(),
  }
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
      setTx(previewTx(preview.apply(previewProfile(preview.state, input)), copy, copy.txSuccess))
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
      setTx(previewTx(preview.apply(previewInvoice(preview.state, input)), copy, copy.txSuccess))
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
      setTx(previewTx(preview.apply(previewCancel(preview.state, id)), copy, copy.txSuccess))
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
      setTx(previewTx(preview.apply(previewUsePass(preview.state, id, action)), copy, copy.txSuccess))
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
      setTx({ phase: "success", message: copy.thenPay, hash, purpose: "approval" })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  async function pay() {
    if (!invoice) return
    if (preview) {
      setTx(previewTx(preview.apply(previewPay(preview.state, invoice.id)), copy, copy.txSuccess))
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

export type NameStatus = "loading" | "invalid" | "unknown" | "ready" | "unavailable"

/// 先读注册表。已注册的名字用链上持有人和档案。样本只在名字未注册或这次没读到时补上。
export function useResolvedName(rawName: string) {
  const preview = usePreview()
  const normalized = normalizeHandle(decodeURIComponent(rawName))
  const shapeOk = isHandleShape(normalized)
  const fixture = Boolean(preview && isPreviewFixture(normalized))
  const ownerRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "ownerOfHandle",
    args: [normalized],
    query: { enabled: shapeOk },
  })
  const owner = ownerRead.data
  const knownHolder = Boolean(owner && owner !== zeroAddress)
  const validRead = useReadContract({
    address: AGENT_ID,
    abi: agentAbi,
    functionName: "isValidHandle",
    args: [normalized],
    query: { enabled: shapeOk && ownerRead.isSuccess && !knownHolder },
  })
  const tokenId = shapeOk ? agentTokenId(normalized) : undefined
  const profileRead = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "profile",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: shapeOk && knownHolder && Boolean(NAMEPAY) },
  })

  // 链上有持有人时，用链上结果。样本只补“还没注册”或“这次没读到”的走查。
  const chainFailed = ownerRead.isError || (ownerRead.isSuccess && !knownHolder && validRead.isError)
  let status: NameStatus = "loading"
  let sample = false
  if (!shapeOk) status = "invalid"
  else if (knownHolder) status = "ready"
  else if (ownerRead.isPending || ownerRead.isLoading) status = "loading"
  else if (ownerRead.isSuccess && !knownHolder && (validRead.isPending || validRead.isLoading)) status = "loading"
  else if (chainFailed && fixture) {
    status = "ready"
    sample = true
  } else if (chainFailed) status = "unavailable"
  else if (validRead.data === false) status = "invalid"
  else if (fixture) {
    status = "ready"
    sample = true
  } else status = "unknown"

  const profile = knownHolder
    ? profileRead.data
      ? toProfile(profileRead.data)
      : null
    : sample
      ? (preview?.profileOf(normalized) ?? null)
      : null
  const reload = () => {
    void ownerRead.refetch()
    void validRead.refetch()
    void profileRead.refetch()
  }

  return {
    normalized,
    status,
    holder: knownHolder ? owner : sample ? preview?.holderOf(normalized) : undefined,
    profile,
    profilePending: knownHolder && profileRead.isLoading,
    profileUnavailable: knownHolder && profileRead.isError,
    sample,
    reload,
  }
}

export function usePayee(rawName: string) {
  const resolved = useResolvedName(rawName)
  const preview = usePreview()
  const identity = useIdentity()
  const { copy } = useI18n()
  const [tx, setTx] = useState<TxState>(idleTx)
  const { normalized, status, profile } = resolved
  const tokenId = isHandleShape(normalized) ? agentTokenId(normalized) : undefined
  const listed = !preview && status === "ready" && Boolean(NAMEPAY)
  const invoiceIds = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "recipientInvoiceIds",
    args: tokenId !== undefined ? [tokenId, 0n, 20n] : undefined,
    query: { enabled: listed },
  })
  const details = useDetails<InvoiceModel>(invoiceIds.data, "invoice", listed)
  const allowance = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: identity.address && NAMEPAY ? [identity.address, NAMEPAY] : undefined,
    query: { enabled: !preview && Boolean(identity.address && NAMEPAY) },
  })
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
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
      setTx({ phase: "pending", message: copy.txPending, hash, purpose: "payment" })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: success, hash, purpose: "payment" })
    } catch (error) {
      setTx({ phase: "error", message: explainError(error, copy) })
    }
  }

  function blockedReason() {
    if (resolved.profilePending) return copy.loading
    if (resolved.profileUnavailable) return copy.nameUnread
    if (tipsAreClosed(profile)) return copy.errors.TipsClosed
    if (status !== "ready") return status === "unavailable" ? copy.nameUnread : copy.unknownName
    return ""
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
      setTx({ phase: "pending", message: copy.txPending, hash, purpose: "approval" })
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await qc.invalidateQueries()
      setTx({ phase: "success", message: copy.thenPay, hash, purpose: "approval" })
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
    const blocked = blockedReason()
    if (blocked) {
      setTx({ phase: "error", message: blocked })
      return
    }
    if (preview) {
      setTx(
        previewTx(
          preview.apply(
            previewTip(preview.state, normalized, input, {
              resolved: !resolved.sample,
              tipsClosed: tipsAreClosed(profile),
              holder: resolved.sample ? undefined : resolved.holder,
            }),
          ),
          copy,
          copy.txSuccess,
        ),
      )
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
      setTx(previewTx(preview.apply(previewBuyPass(preview.state, normalized)), copy, copy.txSuccess))
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
    ...resolved,
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

const tipSentEvent = parseAbiItem(
  "event TipSent(uint256 indexed tipId, uint256 indexed recipientAgentId, uint256 indexed payerAgentId, address payer, address recipient, address token, uint256 amount)",
)

export function useIncomingTips(handle: string) {
  const preview = usePreview()
  const qc = useQueryClient()
  const normalized = normalizeHandle(handle)
  const tokenId = isHandleShape(normalized) ? agentTokenId(normalized) : undefined
  const enabled = !preview && Boolean(NAMEPAY) && tokenId !== undefined
  const ids = useReadContract({
    address: NAMEPAY ?? zeroAddress,
    abi: namepayAbi,
    functionName: "receivedTipIds",
    args: tokenId !== undefined ? [tokenId, 0n, 20n] : undefined,
    query: { enabled, refetchInterval: 5_000 },
  })
  const details = useDetails<TipModel>(ids.data, "tipInfo", enabled)
  const logs = useQuery({
    queryKey: ["namepay-tip-logs", tokenId?.toString() ?? ""],
    enabled,
    refetchInterval: 5_000,
    queryFn: async () => {
      const empty: Record<string, `0x${string}`> = {}
      if (!NAMEPAY || tokenId === undefined) return empty
      const client = getPublicClient(wagmiConfig)
      if (!client) return empty
      try {
        const latest = await client.getBlockNumber()
        const span = 4_500n
        const fromBlock = latest > span ? latest - span : 0n
        const found = await client.getLogs({
          address: NAMEPAY,
          event: tipSentEvent,
          args: { recipientAgentId: tokenId },
          fromBlock,
          toBlock: latest,
        })
        const map: Record<string, `0x${string}`> = {}
        for (const log of found) {
          if (log.args.tipId !== undefined) map[log.args.tipId.toString()] = log.transactionHash
        }
        return map
      } catch {
        return empty
      }
    },
  })
  useWatchContractEvent({
    address: NAMEPAY ?? undefined,
    abi: namepayAbi,
    eventName: "TipSent",
    args: tokenId !== undefined ? { recipientAgentId: tokenId } : undefined,
    enabled,
    onLogs() {
      void ids.refetch()
      void logs.refetch()
      void qc.invalidateQueries()
    },
  })

  const chainReady = Boolean(enabled && ids.isSuccess && details.ready && !details.error)
  const merged = withTipHashes(details.items, logs.data ?? {})
  const cached = !preview && normalized ? loadInbox(normalized) : []
  const signature = chainReady ? merged.map((item) => `${item.id.toString()}:${item.txHash ?? ""}`).join(",") : ""
  const savedSig = useRef<string | null>(null)
  useEffect(() => {
    if (!chainReady || !normalized) return
    const mark = `${normalized}:${signature}`
    if (savedSig.current === mark) return
    savedSig.current = mark
    saveInbox(normalized, merged)
  }, [chainReady, merged, normalized, signature])

  const items = preview ? preview.state.tips.filter((item) => item.toHandle === normalized) : chainReady ? merged : cached
  const refreshing = ids.isLoading || ids.isPending || details.loading
  return {
    items,
    loading: !preview && enabled && !chainReady && cached.length === 0 && refreshing,
    stale: !preview && !chainReady && cached.length > 0 && (ids.isError || Boolean(details.error)),
    failed: !preview && enabled && !chainReady && cached.length === 0 && (ids.isError || Boolean(details.error)),
    refetch: () => {
      void ids.refetch()
      void logs.refetch()
      void details.refetch()
    },
  }
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
