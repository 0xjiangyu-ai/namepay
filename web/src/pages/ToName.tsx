import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { zeroAddress } from "viem"
import { USDC } from "../config.ts"
import { SwitchNetwork } from "../components/Connect.tsx"
import { Button, controlClass, Field, InvoiceRow, TxBanner } from "../components/ui.tsx"
import { useI18n } from "../i18n.tsx"
import { formatToken, parseAmount, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { tipsAreClosed } from "../lib/payeeRules.ts"
import { usePayee } from "../session.tsx"

export function ToName() {
  const { name = "" } = useParams()
  const payee = usePayee(name)
  const { copy } = useI18n()
  const [token, setToken] = useState<`0x${string}`>(zeroAddress)
  const [amount, setAmount] = useState("0")
  const [memo, setMemo] = useState("")
  const busy = payee.tx.phase === "wallet" || payee.tx.phase === "pending"
  const parsed = parseAmount(amount || "0")
  const profile = payee.profile
  const needsTipApproval = Boolean(payee.live && parsed && parsed > 0n && token === USDC && parsed > payee.allowance)
  const needsPassApproval = Boolean(
    payee.live && profile?.passOpen && profile.passToken === USDC && profile.passPrice > payee.allowance && profile.passPrice > 0n,
  )
  const self = payee.identity.tokenId && payee.normalized && payee.identity.handle === payee.normalized
  const ready = payee.status === "ready"
  const tipsClosed = tipsAreClosed(profile)

  return (
    <div className="mx-auto grid max-w-5xl gap-6 py-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section>
        <h1 className="serif text-4xl">{copy.tipTitle}</h1>
        <p className="mt-2 text-sm text-muted">{copy.tipLead}</p>
        <div className="mt-4">
          <TxBanner tx={payee.tx} onClose={payee.clearTx} />
        </div>
        {payee.status === "loading" ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
        {payee.status === "invalid" ? <p className="mt-4 text-sm">{copy.invalidName}</p> : null}
        {payee.status === "unknown" ? <p className="mt-4 text-sm">{copy.unknownName}</p> : null}
        {payee.status === "unavailable" || payee.profileUnavailable ? <p className="mt-4 text-sm">{copy.nameUnread}</p> : null}
        {ready ? (
          <article className="mt-5 rounded-3xl bg-ink p-5 text-paper">
            <p className="text-xs uppercase tracking-[0.16em] text-paper/60">{copy.toLabel}</p>
            <h2 className="serif text-5xl">{displayName(payee.normalized)}</h2>
            <p className="mt-2 text-sm text-paper/75">
              {copy.currentHolder} {payee.holder ? shortAddress(payee.holder) : ""}
            </p>
            <p className="mt-4 text-sm text-paper/85">{profile?.active ? profile.bio || copy.profileOff : copy.profileOff}</p>
          </article>
        ) : null}
      </section>
      {ready ? (
        <section className="space-y-4">
          {self ? <p className="rounded-2xl bg-card px-4 py-3 text-sm">{copy.yourName}</p> : null}
          {payee.identity.status === "disconnected" ? <p className="text-sm text-muted">{copy.disconnectedBody}</p> : null}
          {payee.identity.status === "no-agent" ? <p className="text-sm">{copy.noAgentBody}</p> : null}
          {payee.identity.status === "wrong-network" ? <SwitchNetwork /> : null}
          {!self && payee.identity.status === "ready" ? (
            <form
              className="space-y-3 rounded-3xl border border-line bg-card p-5"
              onSubmit={(event) => {
                event.preventDefault()
                void payee.tip({ token, amount, memo })
              }}
            >
              <h2 className="serif text-2xl">{copy.tipAmount}</h2>
              {tipsClosed ? (
                <div>
                  <p className="font-medium text-brick">{copy.tipsClosedTitle}</p>
                  <p className="text-sm text-brick">{copy.tipsClosedBody}</p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.amount}>
                  <input className={controlClass} value={amount} onChange={(event) => setAmount(event.target.value)} />
                </Field>
                <Field label={copy.token}>
                  <select className={controlClass} value={token} onChange={(event) => setToken(event.target.value as `0x${string}`)}>
                    <option value={zeroAddress}>BNB</option>
                    <option value={USDC}>USDC</option>
                  </select>
                </Field>
              </div>
              <Field label={copy.memo}>
                <input className={controlClass} maxLength={140} value={memo} onChange={(event) => setMemo(event.target.value)} />
              </Field>
              {needsTipApproval ? <p className="text-sm text-muted">{copy.approveHint}</p> : null}
              {needsTipApproval ? (
                <Button type="button" disabled={busy || !parsed} onClick={() => parsed && void payee.approve(parsed)}>
                  {copy.approveExact}
                </Button>
              ) : (
                <Button type="submit" disabled={busy || tipsClosed || payee.profilePending}>
                  {copy.sendTip}
                </Button>
              )}
            </form>
          ) : null}
          {!self && profile?.active && profile.passOpen && payee.identity.status === "ready" ? (
            <div className="rounded-3xl border border-line bg-card p-5">
              <h2 className="serif text-2xl">{copy.passOffer}</h2>
              <p className="mt-1 text-sm text-muted">
                {profile.passLabel} · {profile.passPrice === 0n ? copy.free : formatToken(profile.passPrice, profile.passToken)}
              </p>
              <p className="mt-2 text-sm">{copy.forPayer}</p>
              {needsPassApproval ? <p className="mt-2 text-sm text-muted">{copy.approveHint}</p> : null}
              <Button
                className="mt-3"
                disabled={busy}
                onClick={() => (needsPassApproval ? void payee.approve(profile.passPrice) : void payee.buy())}
              >
                {needsPassApproval ? copy.approveExact : copy.buyPass}
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            <h2 className="serif text-2xl">{copy.unpaidHere}</h2>
            {payee.invoices.length === 0 ? <p className="text-sm text-muted">{copy.noUnpaid}</p> : null}
            {payee.invoices.map((invoice) => (
              <InvoiceRow key={invoice.id.toString()} invoice={invoice} basePath={payee.basePath} />
            ))}
          </div>
          {!payee.configured ? <p className="text-sm">{copy.configuredMissing}</p> : null}
          <Link to={`${payee.basePath}/desk`} className="inline-block text-sm underline">
            {copy.backDesk}
          </Link>
        </section>
      ) : null}
    </div>
  )
}
