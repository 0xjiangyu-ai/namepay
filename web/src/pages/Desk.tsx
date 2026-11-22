import { type ReactNode, useState } from "react"
import { zeroAddress } from "viem"
import { USDC } from "../config.ts"
import { SwitchNetwork } from "../components/Connect.tsx"
import { Button, controlClass, CopyButton, Field, InvoiceRow, TxBanner } from "../components/ui.tsx"
import { useI18n } from "../i18n.tsx"
import { formatToken, shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import type { PassModel } from "../models.ts"
import { useDesk } from "../session.tsx"

export function Desk() {
  const { copy } = useI18n()
  const desk = useDesk()
  const { identity } = desk
  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="serif text-4xl">{copy.deskTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{copy.deskLead}</p>
      </div>
      <TxBanner tx={desk.tx} onClose={desk.clearTx} />
      {identity.status === "loading" ? <p className="text-sm text-muted">{copy.loadingIdentity}</p> : null}
      {identity.status === "disconnected" ? (
        <Notice title={copy.disconnectedTitle} body={copy.disconnectedBody} />
      ) : null}
      {identity.status === "wrong-network" ? <SwitchNetwork /> : null}
      {identity.status === "no-agent" ? <Notice title={copy.noAgentTitle} body={copy.noAgentBody} /> : null}
      {identity.status === "error" ? (
        <Notice title={copy.rpcError} body={identity.error || copy.rpcError}>
          <Button variant="ghost" onClick={identity.reload}>
            {copy.retry}
          </Button>
        </Notice>
      ) : null}
      {identity.status === "ready" ? <Ready desk={desk} /> : null}
    </div>
  )
}

function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="serif text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  )
}

function Ready({ desk }: { desk: ReturnType<typeof useDesk> }) {
  const { copy } = useI18n()
  const { identity } = desk
  const busy = desk.tx.phase === "wallet" || desk.tx.phase === "pending"
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <section className="rounded-3xl bg-ink p-5 text-paper">
          <p className="text-xs uppercase tracking-[0.16em] text-paper/70">{copy.youAre}</p>
          <h2 className="serif mt-1 text-4xl">{displayName(identity.handle || "")}</h2>
          <p className="mt-2 font-mono text-xs text-paper/70">
            {identity.address ? shortAddress(identity.address) : ""} · {copy.tokenId} {identity.tokenId?.toString().slice(0, 10)}…
          </p>
          <div className="mt-4">
            <CopyButton
              value={`${window.location.origin}${desk.basePath}/to/${identity.handle}.ai`}
              label={copy.shareName}
              className="!text-paper"
            />
          </div>
        </section>
        {!desk.configured ? <p className="rounded-2xl bg-card px-4 py-3 text-sm">{copy.configuredMissing}</p> : null}
        <ProfileForm
          key={`${identity.handle}-${desk.profile?.active}-${desk.profile?.bio}-${desk.profile?.passLabel}`}
          busy={busy}
          onSubmit={desk.onProfile}
          active={Boolean(desk.profile?.active)}
          bio={desk.profile?.bio || ""}
          tips={desk.profile?.tipsOpen ?? true}
          passOpen={Boolean(desk.profile?.passOpen)}
          passPrice={desk.profile ? formatPlain(desk.profile.passPrice) : "0"}
          passToken={desk.profile?.passToken || zeroAddress}
          passLabel={desk.profile?.passLabel || ""}
        />
        <InvoiceForm busy={busy} onSubmit={desk.onInvoice} />
      </div>
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-2xl">{copy.invoicesTitle}</h2>
            <span className="text-xs text-muted">{copy.latest}</span>
          </div>
          {desk.listsLoading ? <p className="text-sm text-muted">{copy.loading}</p> : null}
          {!desk.listsLoading && desk.invoices.length === 0 ? <Empty text={copy.emptyInvoices} /> : null}
          {desk.invoices.map((invoice) => (
            <InvoiceRow key={invoice.id.toString()} invoice={invoice} basePath={desk.basePath} onCancel={desk.onCancel} />
          ))}
        </section>
        <PassList passes={desk.passes} busy={busy} onUse={desk.onUsePass} />
        <Activity sent={desk.tipsSent} received={desk.tipsReceived} paid={desk.paid} />
      </div>
    </div>
  )
}

function formatPlain(value: bigint) {
  const whole = value / 10n ** 18n
  const frac = value % 10n ** 18n
  if (frac === 0n) return whole.toString()
  return `${whole}.${frac.toString().padStart(18, "0").replace(/0+$/, "")}`
}

function ProfileForm({
  busy,
  onSubmit,
  active,
  bio,
  tips,
  passOpen,
  passPrice,
  passToken,
  passLabel,
}: {
  busy: boolean
  onSubmit: ReturnType<typeof useDesk>["onProfile"]
  active: boolean
  bio: string
  tips: boolean
  passOpen: boolean
  passPrice: string
  passToken: `0x${string}`
  passLabel: string
}) {
  const { copy } = useI18n()
  const [form, setForm] = useState({ bio, tips, passOpen, passPrice, passToken, passLabel })
  return (
    <form
      className="space-y-3 rounded-3xl border border-line bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({
          bio: form.bio,
          tipsOpen: form.tips,
          passOpen: form.passOpen,
          passToken: form.passToken,
          passPrice: form.passPrice,
          passLabel: form.passLabel,
        })
      }}
    >
      <h2 className="serif text-2xl">{copy.profileTitle}</h2>
      <p className="text-sm text-muted">{copy.profileHint}</p>
      <Field label={copy.bio}>
        <textarea className={controlClass} maxLength={140} rows={3} value={form.bio} placeholder={copy.bioPlaceholder} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.tips} onChange={(event) => setForm({ ...form, tips: event.target.checked })} />
        {copy.tipsOpen}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.passOpen} onChange={(event) => setForm({ ...form, passOpen: event.target.checked })} />
        {copy.passOpen}
      </label>
      {form.passOpen ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={copy.passPrice}>
            <input className={controlClass} value={form.passPrice} onChange={(event) => setForm({ ...form, passPrice: event.target.value })} />
          </Field>
          <Field label={copy.token}>
            <select className={controlClass} value={form.passToken} onChange={(event) => setForm({ ...form, passToken: event.target.value as `0x${string}` })}>
              <option value={zeroAddress}>BNB</option>
              <option value={USDC}>USDC</option>
            </select>
          </Field>
          <Field label={copy.passLabel}>
            <input className={controlClass} maxLength={48} value={form.passLabel} onChange={(event) => setForm({ ...form, passLabel: event.target.value })} />
          </Field>
        </div>
      ) : null}
      <Button type="submit" disabled={busy}>
        {active ? copy.updateProfile : copy.activate}
      </Button>
    </form>
  )
}

function InvoiceForm({ busy, onSubmit }: { busy: boolean; onSubmit: ReturnType<typeof useDesk>["onInvoice"] }) {
  const { copy } = useI18n()
  const [token, setToken] = useState<`0x${string}`>(zeroAddress)
  const [amount, setAmount] = useState("0")
  const [memo, setMemo] = useState("")
  const [deadline, setDeadline] = useState("")
  const [onlyName, setOnlyName] = useState(false)
  const [restricted, setRestricted] = useState("")
  const [mintPass, setMintPass] = useState(false)
  const [passLabel, setPassLabel] = useState("")
  return (
    <form
      className="space-y-3 rounded-3xl border border-line bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({ token, amount, memo, deadline, onlyName, restricted, mintPass, passLabel })
      }}
    >
      <h2 className="serif text-2xl">{copy.invoiceTitle}</h2>
      <p className="text-sm text-muted">{copy.invoiceHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.amount}>
          <input className={controlClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label={copy.token}>
          <select className={controlClass} value={token} onChange={(event) => setToken(event.target.value as `0x${string}`)}>
            <option value={zeroAddress}>BNB</option>
            <option value={USDC}>USDC</option>
          </select>
        </Field>
      </div>
      <Field label={copy.memo}>
        <input className={controlClass} maxLength={140} value={memo} placeholder={copy.memoPlaceholder} onChange={(event) => setMemo(event.target.value)} />
      </Field>
      <Field label={copy.deadline} hint={copy.deadlineHint}>
        <input className={controlClass} type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyName} onChange={(event) => setOnlyName(event.target.checked)} />
        {copy.onlyName}
      </label>
      {onlyName ? (
        <input className={controlClass} value={restricted} placeholder={copy.restrictedPlaceholder} onChange={(event) => setRestricted(event.target.value)} />
      ) : (
        <p className="text-xs text-muted">{copy.anyone}</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mintPass} onChange={(event) => setMintPass(event.target.checked)} />
        {copy.mintPass}
      </label>
      {mintPass ? (
        <Field label={copy.passLabel}>
          <input className={controlClass} maxLength={48} value={passLabel} onChange={(event) => setPassLabel(event.target.value)} />
        </Field>
      ) : null}
      <Button type="submit" disabled={busy}>
        {copy.createInvoice}
      </Button>
    </form>
  )
}

function PassList({
  passes,
  busy,
  onUse,
}: {
  passes: PassModel[]
  busy: boolean
  onUse: (id: bigint, action: string) => Promise<void>
}) {
  const { copy, lang } = useI18n()
  const [actions, setActions] = useState<Record<string, string>>({})
  return (
    <section className="space-y-3">
      <h2 className="serif text-2xl">{copy.passesTitle}</h2>
      {passes.length === 0 ? <Empty text={copy.emptyPasses} /> : null}
      {passes.map((pass) => (
        <article key={pass.id.toString()} className="rounded-3xl border border-line bg-card p-4">
          <h3 className="font-semibold">{pass.label}</h3>
          <p className="text-sm text-muted">
            {copy.boundTo} {displayName(pass.holderHandle)} · {copy.issuedBy} {displayName(pass.issuerHandle)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {copy.uses}: {pass.uses.toString()}
            {pass.lastAction ? ` · ${copy.lastAction}: ${pass.lastAction}` : ""}
            {pass.lastUsedAt ? ` · ${formatTokenTime(pass.lastUsedAt, lang)}` : ""}
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void onUse(pass.id, actions[pass.id.toString()] || copy.actionPlaceholder)
            }}
          >
            <input
              className={controlClass}
              maxLength={32}
              placeholder={copy.actionPlaceholder}
              value={actions[pass.id.toString()] || ""}
              onChange={(event) => setActions({ ...actions, [pass.id.toString()]: event.target.value })}
            />
            <Button type="submit" disabled={busy}>
              {copy.usePass}
            </Button>
          </form>
        </article>
      ))}
    </section>
  )
}

function formatTokenTime(value: bigint, lang: "en" | "zh") {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(Number(value) * 1000),
  )
}

function Activity({
  sent,
  received,
  paid,
}: {
  sent: ReturnType<typeof useDesk>["tipsSent"]
  received: ReturnType<typeof useDesk>["tipsReceived"]
  paid: ReturnType<typeof useDesk>["paid"]
}) {
  const { copy, lang } = useI18n()
  const rows = [
    ...paid.map((item) => ({ id: `pay-${item.id}`, text: `${copy.paidBy} ${displayName(item.handle)} · ${formatToken(item.amount, item.token)}`, time: item.paidAt })),
    ...sent.map((item) => ({ id: `sent-${item.id}`, text: `${copy.sent} ${displayName(item.toHandle)} · ${formatToken(item.amount, item.token)}`, time: item.timestamp })),
    ...received.map((item) => ({ id: `in-${item.id}`, text: `${copy.received} ${displayName(item.fromHandle)} · ${formatToken(item.amount, item.token)}`, time: item.timestamp })),
  ]
  return (
    <section className="space-y-3">
      <h2 className="serif text-2xl">{copy.activityTitle}</h2>
      {rows.length === 0 ? <Empty text={copy.emptyActivity} /> : null}
      {rows.map((row) => (
        <p key={row.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
          {row.text}
          {row.time ? <span className="mt-1 block text-xs text-muted">{formatTokenTime(row.time, lang)}</span> : null}
        </p>
      ))}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-sm text-muted">{text}</p>
}
