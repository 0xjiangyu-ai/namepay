import { Link, useParams } from "react-router-dom"
import { zeroAddress } from "viem"
import { SwitchNetwork } from "../components/Connect.tsx"
import { Button, TxBanner } from "../components/ui.tsx"
import { invoiceTone } from "../components/ui.tsx"
import { useI18n } from "../i18n.tsx"
import { formatToken, formatWhen, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { usePay } from "../session.tsx"

export function Pay() {
  const { invoiceId } = useParams()
  const pay = usePay(invoiceId)
  const { copy, lang } = useI18n()
  const { invoice, identity } = pay
  const tone = invoice ? invoiceTone(invoice) : "open"
  const self = Boolean(invoice && identity.tokenId && invoice.recipientAgentId === identity.tokenId)
  const blocked =
    Boolean(invoice && identity.tokenId && invoice.restrictedPayerAgentId !== 0n && invoice.restrictedPayerAgentId !== identity.tokenId)
  const busy = pay.tx.phase === "wallet" || pay.tx.phase === "pending"

  return (
    <div className="mx-auto max-w-xl py-4">
      <Link to={`${pay.basePath || ""}/desk`} className="text-sm text-muted underline">
        {copy.backDesk}
      </Link>
      <h1 className="serif mt-3 text-4xl">{copy.payTitle}</h1>
      <div className="mt-4">
        <TxBanner tx={pay.tx} onClose={pay.clearTx} />
      </div>
      {pay.invalid ? <p className="mt-4 text-sm">{copy.payInvalid}</p> : null}
      {pay.missingConfig ? <p className="mt-4 rounded-2xl bg-card px-4 py-3 text-sm">{copy.configuredMissing}</p> : null}
      {pay.loading ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
      {pay.missing ? <p className="mt-4 text-sm">{copy.payMissing}</p> : null}
      {invoice ? (
        <article className="slip mt-5 rounded-3xl border border-line p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-stamp">{displayName(invoice.handle)}</p>
          <p className="serif mt-2 text-5xl">{invoice.amount === 0n ? copy.free : formatToken(invoice.amount, invoice.token)}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-muted">{copy.memoLabel}</dt>
              <dd>{invoice.memo || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{copy.toLabel}</dt>
              <dd>
                {displayName(invoice.handle)}
                <span className="mt-1 block text-xs text-muted">
                  {copy.currentHolder} {pay.holder ? shortAddress(pay.holder) : copy.loading}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">{copy.payer}</dt>
              <dd>{invoice.restrictedPayerHandle ? displayName(invoice.restrictedPayerHandle) : copy.anyHolder}</dd>
            </div>
            {invoice.deadline ? (
              <div>
                <dt className="text-muted">{copy.deadline}</dt>
                <dd>{formatWhen(invoice.deadline, lang)}</dd>
              </div>
            ) : null}
          </dl>
          {invoice.mintPass ? <p className="mt-4 rounded-2xl bg-pine-2 px-3 py-2 text-sm">{copy.passOnPay}</p> : null}
          {tone === "paid" ? <p className="mt-4 text-sm">{copy.alreadyDone}</p> : null}
          {tone === "cancelled" ? <p className="mt-4 text-sm">{copy.wasCancelled}</p> : null}
          {tone === "expired" ? <p className="mt-4 text-sm">{copy.wasExpired}</p> : null}
          {identity.status === "disconnected" ? <p className="mt-4 text-sm">{copy.disconnectedBody}</p> : null}
          {identity.status === "no-agent" ? <p className="mt-4 text-sm">{copy.noAgentBody}</p> : null}
          {identity.status === "wrong-network" ? (
            <div className="mt-4">
              <SwitchNetwork />
            </div>
          ) : null}
          {self ? <p className="mt-4 text-sm">{copy.selfHere}</p> : null}
          {blocked ? <p className="mt-4 text-sm">{copy.notPayer}</p> : null}
          {tone === "open" && identity.status === "ready" && !self && !blocked ? (
            <div className="mt-5 space-y-3">
              {pay.needsApproval ? <p className="text-sm text-muted">{copy.approveHint}</p> : null}
              {pay.needsApproval ? (
                <Button className="w-full" disabled={busy} onClick={() => void pay.approve()}>
                  {copy.approveExact}
                </Button>
              ) : (
                <Button className="w-full" disabled={busy} onClick={() => void pay.pay()}>
                  {invoice.amount === 0n && invoice.token === zeroAddress ? copy.completeFree : copy.payAction}
                </Button>
              )}
            </div>
          ) : null}
        </article>
      ) : null}
      <p className="mt-4 text-xs text-muted">{copy.disclaimer}</p>
    </div>
  )
}
