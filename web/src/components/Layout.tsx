import { NavLink, Outlet } from "react-router-dom"
import { AGENT_ID } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { shortAddress } from "../lib/format.ts"
import { usePreview } from "../preview.tsx"
import { useRegistryLabel } from "../session.tsx"
import { ConnectButton } from "./Connect.tsx"

export function Layout() {
  const { copy, lang, setLang } = useI18n()
  const preview = usePreview()
  const registry = useRegistryLabel()
  const home = preview ? "/preview" : "/"
  const desk = preview ? "/preview/desk" : "/desk"
  const booth = preview ? "/preview/booth" : "/booth"
  const how = preview ? "/preview/how" : "/how"
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-8 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
        <NavLink to={home} className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
          <span className="serif text-2xl">{copy.brand}</span>
        </NavLink>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to={booth} className={({ isActive }) => (isActive ? "font-semibold" : "text-muted")}>
            {copy.navBooth}
          </NavLink>
          <NavLink to={desk} className={({ isActive }) => (isActive ? "font-semibold" : "text-muted")}>
            {copy.navDesk}
          </NavLink>
          <NavLink to={how} className={({ isActive }) => (isActive ? "font-semibold" : "text-muted")}>
            {copy.navHow}
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-full border border-line bg-card p-1 text-xs">
            <button
              type="button"
              className={`rounded-full px-2 py-1 ${lang === "en" ? "bg-ink text-paper" : ""}`}
              onClick={() => setLang("en")}
            >
              {copy.langEn}
            </button>
            <button
              type="button"
              className={`rounded-full px-2 py-1 ${lang === "zh" ? "bg-ink text-paper" : ""}`}
              onClick={() => setLang("zh")}
            >
              {copy.langZh}
            </button>
          </div>
          <ConnectButton />
        </div>
      </header>
      {preview ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stamp/40 bg-card px-4 py-3 text-sm">
          <p>{copy.previewBanner}</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preview.rejectNext}
              onChange={(event) => preview.setRejectNext(event.target.checked)}
            />
            {copy.previewReject}
          </label>
        </div>
      ) : null}
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-10 space-y-3 border-t border-line pt-4 text-xs text-muted">
        <p>
          {registry.loading
            ? copy.registryPending
            : registry.error || !registry.name
              ? copy.registryFail
              : `${copy.registryLive}: ${registry.name} · ${registry.symbol} · ${shortAddress(AGENT_ID)}`}
        </p>
        <p>{copy.disclaimer}</p>
      </footer>
    </div>
  )
}
