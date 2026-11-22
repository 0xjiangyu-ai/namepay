import { type ButtonHTMLAttributes, type ReactNode, useState } from "react"
import { Link } from "react-router-dom"
import { zeroAddress } from "viem"
import { EXPLORER } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { formatToken, formatWhen, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import type { InvoiceModel, TxState } from "../models.ts"

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "ink" }) {
  const styles = {
    primary: "bg-pine text-paper hover:bg-pine/90",
    ghost: "border border-line bg-card text-ink hover:bg-white",
    ink: "bg-ink text-paper hover:bg-ink/90",
  }[variant]
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const controlClass =
  "w-full rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none placeholder:text-muted/70"

export function TxBanner({ tx, onClose }: { tx: TxState; onClose: () => void }) {
  const { copy } = useI18n()
  if (tx.phase === "idle") return null
  const tone =
    tx.phase === "error" ? "border-brick/30 bg-brick/5 text-brick" : "border-pine/30 bg-pine-2 text-ink"
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <div>
        <p>{tx.message}</p>
        {tx.hash && EXPLORER ? (
          <a className="underline" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
            {copy.viewTx}
          </a>
        ) : null}
      </div>
      <button type="button" className="text-xs underline" onClick={onClose}>
        {copy.dismiss}
      </button>
    </div>
  )
}

export function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { copy } = useI18n()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={`text-sm font-medium text-pine underline ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          window.setTimeout(() => setDone(false), 1400)
        } catch {
          window.prompt(label, value)
        }
      }}
    >
      {done ? copy.copied : label}
    </button>
  )
}

export function invoiceTone(invoice: InvoiceModel) {
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (invoice.paid) return "paid" as const
  if (invoice.cancelled) return "cancelled" as const
  if (invoice.deadline !== 0n && now > invoice.deadline) return "expired" as const
  return "open" as const
}

export function InvoiceRow({
  invoice,
  basePath,
  onCancel,
}: {
  invoice: InvoiceModel
  basePath: string
  onCancel?: (id: bigint) => void
}) {
  const { copy, lang } = useI18n()
  const tone = invoiceTone(invoice)
  const label = {
    paid: copy.statusPaid,
    cancelled: copy.statusCancelled,
    expired: copy.statusExpired,
    open: copy.statusOpen,
  }[tone]
  const href = `${basePath}/pay/${invoice.id}`
  return (
    <article className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="serif text-2xl">{formatToken(invoice.amount, invoice.token)}</p>
          <p className="text-sm text-muted">
            {displayName(invoice.handle)} · {invoice.memo || copy.memoLabel}
          </p>
        </div>
        <span className="rounded-full bg-paper px-2 py-1 text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        {invoice.restrictedPayerHandle
          ? `${copy.restrictedLine}: ${displayName(invoice.restrictedPayerHandle)}`
          : copy.anyHolder}
        {invoice.mintPass ? ` · ${copy.passOnPay}` : ""}
        {invoice.deadline ? ` · ${formatWhen(invoice.deadline, lang)}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link className="text-sm font-medium text-pine underline" to={href}>
          {copy.payTitle}
        </Link>
        <CopyButton value={`${window.location.origin}${href}`} label={copy.sharePay} />
        {onCancel && tone === "open" ? (
          <button type="button" className="text-sm text-brick" onClick={() => onCancel(invoice.id)}>
            {copy.cancel}
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function AddressLine({ address }: { address?: string }) {
  if (!address || address === zeroAddress) return null
  return <span className="font-mono text-xs">{shortAddress(address)}</span>
}
