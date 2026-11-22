import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import QRCode from "qrcode"
import { useI18n } from "../i18n.tsx"
import { checkoutPath, type CheckoutAsset } from "../lib/checkout.ts"
import { formatToken, formatWhen, shortAddress } from "../lib/format.ts"
import { displayName, normalizeHandle } from "../lib/handles.ts"
import { usePreview } from "../preview.tsx"
import { useIdentity, useIncomingTips } from "../session.tsx"
import { Button, controlClass, Field } from "../components/ui.tsx"

export function Booth() {
  const { copy, lang } = useI18n()
  const preview = usePreview()
  const identity = useIdentity()
  const [name, setName] = useState(preview ? "bao.ai" : "")
  const [amount, setAmount] = useState("0.05")
  const [asset, setAsset] = useState<CheckoutAsset>("bnb")
  const [memo, setMemo] = useState(preview ? "Bangkok booth" : "")
  const [qr, setQr] = useState("")
  const handle = normalizeHandle(name)
  const basePath = preview ? "/preview" : ""
  const path = useMemo(() => {
    if (!handle || !/^\d+(\.\d{1,18})?$/.test(amount) || amount === "0") return ""
    return checkoutPath(basePath, { handle, amount, asset, memo })
  }, [amount, asset, basePath, handle, memo])
  const url = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : ""
  const incoming = useIncomingTips(handle)

  useEffect(() => {
    if (!preview && identity.handle && !name) setName(`${identity.handle}.ai`)
  }, [identity.handle, name, preview])

  useEffect(() => {
    if (!url) {
      setQr("")
      return
    }
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then((value) => {
      if (!cancelled) setQr(value)
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
        </div>
        <form className="space-y-3 rounded-3xl border border-line bg-card p-5" onSubmit={(event) => event.preventDefault()}>
          <Field label={copy.boothName}>
            <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="bao.ai" />
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
          <h2 className="serif text-2xl">{copy.incomingTitle}</h2>
          {incoming.loading ? <p className="text-sm text-muted">{copy.loading}</p> : null}
          {!incoming.loading && incoming.items.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-sm text-muted">{copy.incomingEmpty}</p>
          ) : null}
          {incoming.items.map((item) => (
            <article key={item.id.toString()} className="rounded-3xl border border-line bg-card px-4 py-3 text-sm">
              <p className="font-medium">
                {formatToken(item.amount, item.token)} · {displayName(item.fromHandle)}
              </p>
              <p className="text-muted">{item.memo || "—"}</p>
              {item.timestamp ? <p className="text-xs text-muted">{formatWhen(item.timestamp, lang)}</p> : null}
            </article>
          ))}
        </section>
      </section>
      <aside className="slip rounded-3xl border border-line p-5 text-center">
        <p className="text-xs uppercase tracking-[0.14em] text-stamp">{copy.showQr}</p>
        <h2 className="serif mt-2 text-3xl">{handle ? displayName(handle) : "—"}</h2>
        <p className="mt-1 text-sm text-muted">
          {amount || "0"} {asset.toUpperCase()}
          {memo ? ` · ${memo}` : ""}
        </p>
        {qr ? <img src={qr} alt={copy.showQr} className="mx-auto mt-4 w-full max-w-xs rounded-2xl bg-white p-3" /> : (
          <p className="mt-6 text-sm text-muted">{copy.checkoutIncomplete}</p>
        )}
        {path ? (
          <div className="mt-4">
            <Link to={path}>
              <Button>{copy.openCheckout}</Button>
            </Link>
            <p className="mt-3 break-all text-xs text-muted">{url}</p>
          </div>
        ) : null}
        {identity.address ? <p className="mt-4 font-mono text-xs text-muted">{shortAddress(identity.address)}</p> : null}
      </aside>
    </div>
  )
}
