/// 根路径部署时 base 是 /，链接保持原样。GitHub Pages 项目站的 base 是 /namepay/。
export function appBasename(baseUrl = import.meta.env.BASE_URL) {
  if (!baseUrl || baseUrl === "/") return undefined
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return trimmed || undefined
}

export function absoluteAppUrl(path: string, origin = typeof window === "undefined" ? "" : window.location.origin, baseUrl = import.meta.env.BASE_URL) {
  const base = appBasename(baseUrl) ?? ""
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${origin}${base}${suffix}`
}
