import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import QRCode from "qrcode"
import { EXPLORER, NAMEPAY } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { loadBoothDraft, saveBoothDraft } from "../lib/boothSession.ts"
import { checkoutPath, type CheckoutAsset } from "../lib/checkout.ts"
import { formatToken, formatWhen, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { tipsAreClosed } from "../lib/payeeRules.ts"
import { usePreview } from "../preview.tsx"
import { useIdentity, useIncomingTips, useResolvedName } from "../session.tsx"
import { Button, controlClass, Field } from "../components/ui.tsx"

export function Booth() {
  const { copy, lang } = useI18n()
  const preview = usePreview()
  const identity = useIdentity()
  const previewMode = Boolean(preview)
  const stored = useMemo(() => loadBoothDraft(previewMode), [previewMode])
  // null 表示用户还没改过。实付展台会在身份读到之后显示自己的 Agent ID，不必在 effect 里 setState。
  const [name, setName] = useState<string | null>(stored?.name ?? (previewMode ? "bao.ai" : null))
  const [amount, setAmount] = useState(stored?.amount ?? "0.05")
  const [asset, setAsset] = useState<CheckoutAsset>(stored?.asset ?? "bnb")
  const [memo, setMemo] = useState(stored?.memo ?? (previewMode ? "Bangkok booth" : ""))
  const shownName = name ?? (!previewMode && identity.handle ? `${identity.handle}.ai` : "")
  const [qrFor, setQrFor] = useState("")
  const [qrData, setQrData] = useState("")
  const recipient = useResolvedName(shownName)
  const handle = recipient.normalized
  const closed = tipsAreClosed(recipient.profile)
  const payable =
    recipient.status === "ready" && !closed && !recipient.profilePending && !recipient.profileUnavailable && Boolean(handle)
  const basePath = previewMode ? "/preview" : ""
  const path = useMemo(() => {
    if (!payable || !/^\d+(\.\d{1,18})?$/.test(amount) || amount === "0") return ""
    return checkoutPath(basePath, { handle, amount, asset, memo })
  }, [amount, asset, basePath, handle, memo, payable])
  const url = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : ""
  const incoming = useIncomingTips(handle)

  useEffect(() => {
    if (name === null && !shownName) return
    saveBoothDraft(previewMode, { name: shownName, amount, asset, memo })
  }, [amount, asset, memo, name, previewMode, shownName])

  const qr = url && qrFor === url ? qrData : ""
  useEffect(() => {
    if (!url) return
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then((value) => {
      if (cancelled) return
      setQrFor(url)
      setQrData(value)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="grid items-start gap-6 py-2 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-pine">Bangkok</p>
          <h1 className="serif mt-2 text-4xl">{copy.boothTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{copy.boothLead}</p>
          <p className="mt-3 text-sm leading-6">{copy.boothDifference}</p>
        </div>
        <ol className="space-y-2 rounded-3xl border border-line bg-card px-5 py-4 text-sm">
          <li className="font-medium">{copy.demoTitle}</li>
          <li className="text-muted">{copy.boothPayerRule}</li>
          <li className="text-muted">{copy.boothHistory}</li>
          {NAMEPAY ? (
            <li className="break-all font-mono text-xs text-muted">
              {copy.contractLine} {NAMEPAY}
            </li>
          ) : null}
        </ol>
        <form className="space-y-3 rounded-3xl border border-line bg-card p-5" onSubmit={(event) => event.preventDefault()}>
          <Field label={copy.boothName}>
            <input className={controlClass} value={shownName} onChange={(event) => setName(event.target.value)} placeholder="bao.ai" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={copy.amount}>
              <input className={controlClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label={copy.token}>
              <select className={controlClass} value={asset} onChange={(event) => setAsset(event.target.value as CheckoutAsset)}>
                <option value="bnb">BNB</option>
                <option value="usdc">USDC</option>
              </select>
            </Field>
          </div>
          <Field label={copy.boothMemo}>
            <input className={controlClass} maxLength={140} value={memo} onChange={(event) => setMemo(event.target.value)} />
          </Field>
        </form>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="serif text-2xl">{copy.incomingTitle}</h2>
            <Button variant="ghost" onClick={() => incoming.refetch()}>
              {copy.inboxRefresh}
            </Button>
          </div>
          {incoming.loading ? <p className="text-sm text-muted">{copy.loading}</p> : null}
          {incoming.stale ? <p className="text-sm text-muted">{copy.inboxStale}</p> : null}
          {incoming.failed ? <p className="text-sm">{copy.inboxFailed}</p> : null}
          {!incoming.loading && !incoming.failed && incoming.items.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-sm text-muted">{copy.incomingEmpty}</p>
          ) : null}
          {incoming.items.map((item) => (
            <article key={item.id.toString()} className="rounded-3xl border border-line bg-card px-4 py-3 text-sm">
              <p className="font-medium">
                {formatToken(item.amount, item.token)} · {displayName(item.fromHandle)}
              </p>
              <p className="text-muted">{item.memo || "—"}</p>
              {item.timestamp ? <p className="text-xs text-muted">{formatWhen(item.timestamp, lang)}</p> : null}
              {item.txHash ? (
                previewMode || !EXPLORER ? (
                  <p className="mt-1 break-all font-mono text-sm leading-6">{item.txHash}</p>
                ) : (
                  <a className="mt-1 inline-block text-xs font-medium underline" href={`${EXPLORER}/tx/${item.txHash}`} target="_blank" rel="noreferrer">
                    {shortAddress(item.txHash)}
                  </a>
                )
              ) : null}
            </article>
          ))}
        </section>
      </section>
      <aside className="slip rounded-3xl border border-line p-5 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-stamp">{copy.showQr}</p>
        <h2 className="serif mt-2 text-4xl">{handle ? displayName(handle) : "—"}</h2>
        <p className="mt-1 text-sm text-muted">
          {amount || "0"} {asset.toUpperCase()}
          {memo ? ` · ${memo}` : ""}
        </p>
        <p className="mt-3 text-sm">{copy.notBinance}</p>
        {recipient.status === "loading" || recipient.profilePending ? <p className="mt-4 text-sm text-muted">{copy.loading}</p> : null}
        {recipient.status === "invalid" ? <p className="mt-4 text-sm">{copy.invalidName}</p> : null}
        {recipient.status === "unknown" ? <p className="mt-4 text-sm">{copy.boothUnknown}</p> : null}
        {recipient.status === "unavailable" || recipient.profileUnavailable ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">{copy.boothUnread}</p>
            <Button variant="ghost" onClick={() => recipient.reload()}>
              {copy.retry}
            </Button>
          </div>
        ) : null}
        {closed ? <p className="mt-4 text-sm text-brick">{copy.boothTipsClosed}</p> : null}
        {recipient.status === "ready" && recipient.holder ? (
          <p className="mt-3 break-all font-mono text-xs text-muted">
            {recipient.sample ? copy.sampleHolder : copy.currentHolder} {recipient.holder}
          </p>
        ) : null}
        {qr ? (
          <img src={qr} alt={copy.showQr} className="mx-auto mt-4 w-full max-w-sm rounded-2xl bg-white p-3" />
        ) : recipient.status === "ready" && !closed && !recipient.profilePending ? (
          <p className="mt-6 text-sm text-muted">{copy.checkoutIncomplete}</p>
        ) : null}
        {path ? (
          <div className="mt-4">
            <Link to={path}>
              <Button>{copy.openCheckout}</Button>
            </Link>
            <p className="mt-3 break-all text-xs text-muted">{url}</p>
          </div>
        ) : null}
        {identity.address && !previewMode ? <p className="mt-4 font-mono text-xs text-muted">{shortAddress(identity.address)}</p> : null}
      </aside>
    </div>
  )
}
