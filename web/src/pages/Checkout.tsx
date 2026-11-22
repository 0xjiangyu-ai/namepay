import { Link, useParams, useSearchParams } from "react-router-dom"
import { zeroAddress } from "viem"
import { EXPLORER } from "../config.ts"
import { SwitchNetwork } from "../components/Connect.tsx"
import { Button, TxBanner } from "../components/ui.tsx"
import { useI18n } from "../i18n.tsx"
import { checkoutToken, readCheckoutQuery } from "../lib/checkout.ts"
import { formatToken, parseAmount, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { usePayee } from "../session.tsx"

export function Checkout() {
  const { name = "" } = useParams()
  const [params] = useSearchParams()
  const request = readCheckoutQuery(params)
  const payee = usePayee(name)
  const { copy } = useI18n()
  const token = request ? checkoutToken(request.asset) : zeroAddress
  const parsed = request ? parseAmount(request.amount) : null
  const needsApproval = Boolean(
    payee.live && request?.asset === "usdc" && parsed && parsed > payee.allowance,
  )
  const busy = payee.tx.phase === "wallet" || payee.tx.phase === "pending"
  const self = Boolean(payee.identity.handle && payee.identity.handle === payee.normalized)
  const paid = payee.tx.phase === "success"

  return (
    <div className="mx-auto max-w-xl py-4">
      <Link to={`${payee.basePath}/booth`} className="text-sm text-muted underline">
        {copy.backBooth}
      </Link>
      <h1 className="serif mt-3 text-4xl">{copy.checkoutTitle}</h1>
      <p className="mt-2 text-sm text-muted">{copy.checkoutLead}</p>
      <div className="mt-4">
        <TxBanner tx={payee.tx} onClose={payee.clearTx} />
      </div>
      {!request ? <p className="mt-4 text-sm">{copy.checkoutIncomplete}</p> : null}
      {payee.status === "loading" ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
      {payee.status === "invalid" ? <p className="mt-4 text-sm">{copy.invalidName}</p> : null}
      {payee.status === "unknown" ? <p className="mt-4 text-sm">{copy.unknownName}</p> : null}
      {request && payee.status === "ready" ? (
        <article className="slip mt-5 rounded-3xl border border-line p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-stamp">{copy.receiptTo}</p>
          <h2 className="serif mt-1 text-4xl">{displayName(payee.normalized)}</h2>
          <p className="mt-1 text-sm text-muted">
            {copy.currentHolder} {payee.holder ? shortAddress(payee.holder) : ""}
          </p>
          <p className="serif mt-5 text-5xl">{formatToken(parsed ?? 0n, token)}</p>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.receiptAsset}</dt>
              <dd>{request.asset.toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.receiptFor}</dt>
              <dd>{request.memo || "—"}</dd>
            </div>
          </dl>
          {paid ? (
            <div className="mt-5 rounded-2xl bg-pine-2 px-4 py-4">
              <h3 className="serif text-2xl">{copy.receiptTitle}</h3>
              <p className="mt-1 text-sm">{payee.live ? copy.txSuccess : copy.receiptPreview}</p>
              <p className="mt-2 text-sm">
                {copy.receiptAmount}: {formatToken(parsed ?? 0n, token)}
              </p>
              <p className="text-sm">
                {copy.receiptTo}: {displayName(payee.normalized)}
              </p>
              {payee.tx.hash && EXPLORER ? (
                <a className="mt-2 inline-block text-sm font-medium underline" href={`${EXPLORER}/tx/${payee.tx.hash}`} target="_blank" rel="noreferrer">
                  {copy.viewTx}
                </a>
              ) : null}
            </div>
          ) : null}
          {payee.identity.status === "disconnected" ? <p className="mt-4 text-sm">{copy.disconnectedBody}</p> : null}
          {payee.identity.status === "no-agent" ? <p className="mt-4 text-sm">{copy.noAgentBody}</p> : null}
          {payee.identity.status === "wrong-network" ? (
            <div className="mt-4">
              <SwitchNetwork />
            </div>
          ) : null}
          {self ? <p className="mt-4 text-sm">{copy.yourName}</p> : null}
          {!paid && request && payee.identity.status === "ready" && !self ? (
            <div className="mt-5 space-y-3">
              {needsApproval ? <p className="text-sm text-muted">{copy.approveHint}</p> : null}
              {needsApproval ? (
                <Button className="w-full" disabled={busy || !parsed} onClick={() => parsed && void payee.approve(parsed)}>
                  {copy.approveExact}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => void payee.tip({ token, amount: request.amount, memo: request.memo })}
                >
                  {copy.payNow}
                </Button>
              )}
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  )
}
