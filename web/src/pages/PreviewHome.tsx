import { Link } from "react-router-dom"
import { useI18n } from "../i18n.tsx"

const links = [
  ["/preview/booth", "previewBooth"],
  ["/preview/desk", "previewDesk"],
  ["/preview/empty", "previewEmpty"],
  ["/preview/pay/1", "previewPay"],
  ["/preview/to/bao.ai", "previewTip"],
  ["/preview/to/missing.ai", "previewMissing"],
  ["/preview/checkout/tipoff.ai?amount=0.05&token=bnb&memo=closed", "previewClosed"],
] as const

export function PreviewHome() {
  const { copy } = useI18n()
  return (
    <section className="mx-auto max-w-2xl py-6">
      <h1 className="serif text-4xl">{copy.previewIndexTitle}</h1>
      <p className="mt-3 text-muted">{copy.previewIndexBody}</p>
      <ul className="mt-6 space-y-3">
        {links.map(([href, key]) => (
          <li key={href}>
            <Link className="block rounded-3xl border border-line bg-card px-4 py-4 hover:border-pine" to={href}>
              {copy[key]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
