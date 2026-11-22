import { AGENT_ID, USDC } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { useRegistryLabel } from "../session.tsx"

export function How() {
  const { copy } = useI18n()
  const registry = useRegistryLabel()
  return (
    <article className="mx-auto max-w-3xl py-4">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-pine">{copy.brand}</p>
      <h1 className="serif mt-2 text-4xl sm:text-5xl">{copy.howTitle}</h1>
      <p className="mt-4 text-lg text-muted">{copy.howLead}</p>
      <p className="mt-4 rounded-2xl bg-card px-4 py-3 font-mono text-xs leading-6">
        Agent ID {AGENT_ID}
        <br />
        USDC {USDC}
        <br />
        {registry.name ? `${registry.name} · ${registry.symbol}` : copy.registryPending}
      </p>
      <div className="mt-8 space-y-6">
        {copy.howSections.map((section) => (
          <section key={section.title} className="border-t border-line pt-5">
            <h2 className="serif text-2xl">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-ink/90">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  )
}
