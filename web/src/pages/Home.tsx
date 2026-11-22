import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AGENT_ID } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { normalizeHandle } from "../lib/handles.ts"
import { shortAddress } from "../lib/format.ts"
import { useRegistryLabel } from "../session.tsx"
import { Button, controlClass } from "../components/ui.tsx"

export function Home() {
  const { copy } = useI18n()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const registry = useRegistryLabel()
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="pt-4 lg:pt-10">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-pine">{copy.heroKicker}</p>
        <h1 className="serif mt-3 max-w-xl text-5xl leading-[1.05] sm:text-6xl">{copy.heroTitle}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{copy.heroBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/booth">
            <Button>{copy.navBooth}</Button>
          </Link>
          <Link to="/desk">
            <Button variant="ghost">{copy.openDesk}</Button>
          </Link>
          <Link to="/preview">
            <Button variant="ghost">{copy.previewCta}</Button>
          </Link>
        </div>
        <ol className="mt-10 space-y-4">
          {[
            ["01", copy.stepIdentity, copy.stepIdentityBody],
            ["02", copy.stepPay, copy.stepPayBody],
            ["03", copy.stepAccess, copy.stepAccessBody],
          ].map(([index, title, body]) => (
            <li key={index} className="grid grid-cols-[auto_1fr] gap-4 border-t border-line pt-4">
              <span className="serif text-xl text-stamp">{index}</span>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <aside className="slip rounded-3xl border border-line p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-stamp">{copy.payNameTitle}</p>
        <h2 className="serif mt-2 text-3xl">{copy.payNameHint}</h2>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            const handle = normalizeHandle(name)
            if (!handle) return
            navigate(`/to/${encodeURIComponent(handle.endsWith(".ai") ? handle : `${handle}.ai`)}`)
          }}
        >
          <input
            className={controlClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.payNamePlaceholder}
            aria-label={copy.payNameTitle}
          />
          <Button type="submit" className="w-full">
            {copy.continue}
          </Button>
        </form>
        <div className="mt-6 rounded-2xl border border-dashed border-line p-4 text-sm">
          <p className="font-medium">{copy.safetyTitle}</p>
          <p className="mt-1 text-muted">{copy.safetyBody}</p>
        </div>
        <p className="mt-4 text-xs text-muted">
          {registry.name ? `${registry.name} (${registry.symbol})` : copy.registryPending} · {shortAddress(AGENT_ID)}
        </p>
        <Link to="/how" className="mt-3 inline-block text-sm font-medium text-pine underline">
          {copy.navHow}
        </Link>
      </aside>
    </div>
  )
}
