import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { zeroAddress } from "viem"
import { EXPLORER } from "../config.ts"
import { ConnectButton, SwitchNetwork } from "../components/Connect.tsx"
import { Button, CopyButton, TxBanner } from "../components/ui.tsx"
import { useI18n } from "../i18n.tsx"
import { checkoutToken, readCheckoutQuery } from "../lib/checkout.ts"
import { formatToken, parseAmount, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { tipsAreClosed } from "../lib/payeeRules.ts"
import { clearReceipt, loadReceipt, saveReceipt, type SavedReceipt } from "../lib/receiptStore.ts"
import { usePayee } from "../session.tsx"

export function Checkout() {
  const { name = "" } = useParams()
  const [params] = useSearchParams()
  const request = readCheckoutQuery(params)
  const payee = usePayee(name)
  const { copy } = useI18n()
  const token = request ? checkoutToken(request.asset) : zeroAddress
  const parsed = request ? parseAmount(request.amount) : null
  const needsApproval = Boolean(payee.live && request?.asset === "usdc" && parsed && parsed > payee.allowance)
  const busy = payee.tx.phase === "wallet" || payee.tx.phase === "pending"
  const self = Boolean(payee.identity.handle && payee.identity.handle === payee.normalized)
  const paidNow = payee.tx.phase === "success" && payee.tx.purpose !== "approval" && Boolean(payee.tx.hash)
  const closed = tipsAreClosed(payee.profile)
  const receiptKey =
    request && payee.normalized
      ? {
          preview: !payee.live,
          handle: payee.normalized,
          amount: request.amount,
          asset: request.asset,
          memo: request.memo,
        }
      : null
  const [hideSaved, setHideSaved] = useState(false)
  const saved = receiptKey && !hideSaved ? loadReceipt(receiptKey) : null
  const receipt: SavedReceipt | null = paidNow && payee.tx.hash && receiptKey
    ? {
        ...receiptKey,
        hash: payee.tx.hash,
        holder: payee.holder ?? saved?.holder ?? "",
      }
    : saved

  useEffect(() => {
    if (!paidNow || !payee.tx.hash || !request || !payee.normalized) return
    saveReceipt({
      preview: !payee.live,
      handle: payee.normalized,
      amount: request.amount,
      asset: request.asset,
      memo: request.memo,
      hash: payee.tx.hash,
      holder: payee.holder ?? "",
    })
  }, [paidNow, payee.holder, payee.live, payee.normalized, payee.tx.hash, request])

  const canPay =
    Boolean(request) &&
    payee.status === "ready" &&
    payee.identity.status === "ready" &&
    !self &&
    !closed &&
    !payee.profilePending &&
    !payee.profileUnavailable &&
    !busy

  return (
    <div className="mx-auto max-w-xl py-4">
      <Link to={`${payee.basePath}/booth`} className="text-sm text-muted underline">
        {copy.backBooth}
      </Link>
      <h1 className="serif mt-3 text-4xl">{copy.checkoutTitle}</h1>
      <p className="mt-2 text-sm leading-6">{copy.checkoutDifference}</p>
      <div className="mt-4">
        <TxBanner tx={payee.tx} onClose={payee.clearTx} />
      </div>
      {!request ? <p className="mt-4 text-sm">{copy.checkoutIncomplete}</p> : null}
      {payee.status === "loading" || payee.profilePending ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
      {payee.status === "invalid" ? <p className="mt-4 text-sm">{copy.invalidName}</p> : null}
      {payee.status === "unknown" ? <p className="mt-4 text-sm">{copy.unknownName}</p> : null}
      {payee.status === "unavailable" || payee.profileUnavailable ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">{copy.nameUnread}</p>
          <Button variant="ghost" onClick={() => payee.reload()}>
            {copy.retry}
          </Button>
        </div>
      ) : null}
      {request && payee.status === "ready" && !payee.profileUnavailable ? (
        <article className="slip mt-5 rounded-3xl border border-line p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-stamp">{copy.receiptTo}</p>
          <h2 className="serif mt-1 text-4xl">{displayName(payee.normalized)}</h2>
          <p className="mt-2 text-sm">{copy.notBinance}</p>
          <p className="mt-2 text-sm text-muted">{payee.sample ? copy.sampleHolder : copy.currentHolder}</p>
          {payee.holder ? <p className="mt-1 break-all font-mono text-xs">{payee.holder}</p> : null}
          <p className="serif mt-5 text-5xl">{formatToken(parsed ?? 0n, token)}</p>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.receiptAsset}</dt>
              <dd>{request.asset.toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.receiptFor}</dt>
              <dd className="text-right">{request.memo || "—"}</dd>
            </div>
          </dl>
          {request.asset === "usdc" && payee.live && !receipt ? <p className="mt-4 text-sm text-muted">{copy.checkoutUsdcNote}</p> : null}
          {receipt ? (
            <div className="mt-5 rounded-2xl bg-pine-2 px-4 py-4">
              <h3 className="serif text-2xl">{copy.receiptTitle}</h3>
              <p className="mt-1 text-sm">{receipt.preview ? copy.receiptPreview : copy.receiptConfirmed}</p>
              <p className="mt-2 text-sm">
                {copy.receiptAmount}: {formatToken(parsed ?? 0n, token)}
              </p>
              <p className="text-sm">
                {copy.receiptTo}: {displayName(payee.normalized)}
              </p>
              {receipt.holder ? (
                <p className="mt-1 break-all font-mono text-xs">
                  {shortAddress(receipt.holder)} · {receipt.holder}
                </p>
              ) : null}
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">{copy.receiptHash}</p>
              <p className="mt-1 break-all font-mono text-base leading-7">{receipt.hash}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <CopyButton value={receipt.hash} label={copy.receiptHash} />
                {!receipt.preview && EXPLORER ? (
                  <a className="text-sm font-medium text-pine underline" href={`${EXPLORER}/tx/${receipt.hash}`} target="_blank" rel="noreferrer">
                    {copy.viewTx}
                  </a>
                ) : (
                  <span className="text-xs text-muted">{copy.receiptSimulatedHash}</span>
                )}
              </div>
            </div>
          ) : null}
          {payee.identity.status === "disconnected" ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">{copy.checkoutPayerRule}</p>
              <ConnectButton />
            </div>
          ) : null}
          {payee.identity.status === "no-agent" ? <p className="mt-4 text-sm">{copy.noAgentBody}</p> : null}
          {payee.identity.status === "wrong-network" ? (
            <div className="mt-4">
              <SwitchNetwork />
            </div>
          ) : null}
          {self ? <p className="mt-4 text-sm">{copy.yourName}</p> : null}
          {closed ? (
            <div className="mt-5 rounded-2xl border border-brick/30 bg-brick/5 px-4 py-4 text-sm">
              <h3 className="font-medium">{copy.tipsClosedTitle}</h3>
              <p className="mt-1">{copy.tipsClosedBody}</p>
            </div>
          ) : null}
          {!receipt && canPay ? (
            <div className="mt-5 space-y-3">
              {needsApproval ? <p className="text-sm text-muted">{copy.approveHint}</p> : null}
              {needsApproval ? (
                <Button className="w-full" disabled={busy || !parsed} onClick={() => parsed && void payee.approve(parsed)}>
                  {copy.approveExact}
                </Button>
              ) : (
                <Button className="w-full" disabled={busy} onClick={() => void payee.tip({ token, amount: request.amount, memo: request.memo })}>
                  {payee.live ? copy.payNow : copy.payNowPreview}
                </Button>
              )}
            </div>
          ) : null}
          {receipt && canPay ? (
            <Button
              className="mt-4"
              variant="ghost"
              onClick={() => {
                if (receiptKey) clearReceipt(receiptKey)
                setHideSaved(true)
                payee.clearTx()
              }}
            >
              {copy.payAgain}
            </Button>
          ) : null}
        </article>
      ) : null}
    </div>
  )
}
