import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi"
import { CHAIN_ID, WALLETCONNECT_PROJECT_ID } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { binanceInjectedProvider, binanceNativeLink, binanceUniversalLink, isPhoneBrowser } from "../lib/binanceLink.ts"
import { shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { usePreview } from "../preview.tsx"
import { useIdentity } from "../session.tsx"
import { Button, controlClass } from "./ui.tsx"

type UriMessage = { type: string; data?: unknown }

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const area = document.createElement("textarea")
      area.value = value
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

let activeConnect: Promise<void> | null = null

function useWalletConnectSession() {
  const { connectors, connectAsync } = useConnect()
  const walletConnect = connectors.find((item) => item.id === "walletConnect")
  const binance = connectors.find((item) => item.id === "binanceApp")
  const browserWallet = connectors.find((item) => item.id === "injected")
  const [uri, setUri] = useState("")
  const [qrFor, setQrFor] = useState("")
  const [qrData, setQrData] = useState("")
  const qr = uri && qrFor === uri ? qrData : ""
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (!walletConnect) return
    const onMessage = (message: UriMessage) => {
      if (message.type === "display_uri" && typeof message.data === "string") setUri(message.data)
    }
    walletConnect.emitter.on("message", onMessage)
    return () => {
      walletConnect.emitter.off("message", onMessage)
    }
  }, [walletConnect])

  useEffect(() => {
    if (!uri) return
    let cancelled = false
    QRCode.toDataURL(uri, { margin: 1, width: 280, errorCorrectionLevel: "L", color: { dark: "#1c1712", light: "#ffffff" } })
      .then((value) => {
        if (cancelled) return
        setQrFor(uri)
        setQrData(value)
      })
      .catch(() => {
        if (!cancelled) setQrData("")
      })
    return () => {
      cancelled = true
    }
  }, [uri])

  async function connectWalletConnect(open: (nextUri: string) => void) {
    if (!walletConnect) return
    if (uri) {
      open(uri)
      return
    }
    if (activeConnect) return activeConnect
    setError("")
    setCopied("idle")
    setPending(true)
    let opened = false
    const onMessage = (message: UriMessage) => {
      if (message.type !== "display_uri" || typeof message.data !== "string" || opened) return
      opened = true
      open(message.data)
    }
    walletConnect.emitter.on("message", onMessage)
    activeConnect = connectAsync({ connector: walletConnect, chainId: CHAIN_ID })
      .then(() => undefined)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "")
      })
      .finally(() => {
        walletConnect.emitter.off("message", onMessage)
        setPending(false)
        activeConnect = null
      })
    return activeConnect
  }

  return {
    uri,
    qr,
    pending,
    error,
    copied,
    hasWalletConnect: Boolean(walletConnect && WALLETCONNECT_PROJECT_ID),
    insideBinance: Boolean(binanceInjectedProvider()),
    phone: isPhoneBrowser(),
    openInBinance: () =>
      connectWalletConnect((nextUri) => {
        window.location.assign(binanceUniversalLink(nextUri))
      }),
    retryNative: () => {
      if (uri) window.location.assign(binanceNativeLink(uri))
    },
    showCode: () => connectWalletConnect(() => {}),
    useInjected: async () => {
      const connector = binanceInjectedProvider() ? binance : browserWallet
      if (!connector) return
      setError("")
      setPending(true)
      try {
        await connectAsync({ connector, chainId: CHAIN_ID })
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "")
      } finally {
        setPending(false)
      }
    },
    copyUri: async () => {
      if (!uri) {
        setCopied("failed")
        return
      }
      setCopied((await copyText(uri)) ? "copied" : "failed")
    },
  }
}

function ConnectionCode({
  uri,
  qr,
  pending,
  error,
  copied,
  onCopy,
}: {
  uri: string
  qr: string
  pending: boolean
  error: string
  copied: "idle" | "copied" | "failed"
  onCopy: () => void
}) {
  const { copy } = useI18n()
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm">{copy.binanceQrTitle}</p>
      <p className="text-sm text-muted">{copy.binanceQrHint}</p>
      {pending && !uri ? <p className="text-sm text-muted">{copy.connectingBinance}</p> : null}
      {qr ? <img src={qr} alt={copy.binanceQrTitle} className="mx-auto w-full max-w-xs rounded-2xl bg-white p-3" /> : null}
      {uri ? (
        <>
          <label className="block text-sm">
            <span className="text-muted">{copy.wcUriLabel}</span>
            <input className={`${controlClass} mt-1 font-mono text-xs`} readOnly value={uri} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <Button type="button" variant="ghost" onClick={onCopy}>
            {copied === "copied" ? copy.copied : copy.copyUri}
          </Button>
          {copied === "failed" ? <p className="text-sm text-brick">{copy.copyFailed}</p> : null}
        </>
      ) : null}
      {error ? <p className="text-sm text-brick">{error}</p> : null}
    </div>
  )
}

/// 结账页上的主按钮：手机打开币安 App，电脑则显示我们自己画的连接码。
export function BinancePayConnect() {
  const { copy } = useI18n()
  const session = useWalletConnectSession()
  const [desktop, setDesktop] = useState(false)

  if (session.insideBinance) {
    return (
      <div className="mt-4 space-y-2">
        <Button className="w-full" disabled={session.pending} onClick={() => void session.useInjected()}>
          {copy.openBinance}
        </Button>
        <p className="text-sm text-muted">{copy.openBinanceHint}</p>
        {session.error ? <p className="text-sm text-brick">{session.error}</p> : null}
      </div>
    )
  }

  if (session.phone) {
    return (
      <div className="mt-4 space-y-2">
        <Button className="w-full" disabled={session.pending && !session.uri} onClick={() => void session.openInBinance()}>
          {session.pending ? copy.connectingBinance : copy.openBinance}
        </Button>
        <p className="text-sm text-muted">{copy.openBinanceHint}</p>
        {session.uri ? (
          <button type="button" className="text-sm text-pine underline" onClick={session.retryNative}>
            {copy.openBinanceAgain}
          </button>
        ) : null}
        {session.error ? <p className="text-sm text-brick">{session.error}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <Button
        className="w-full"
        disabled={session.pending && !session.uri}
        onClick={() => {
          setDesktop(true)
          void session.showCode()
        }}
      >
        {copy.openBinance}
      </Button>
      <p className="text-sm text-muted">{copy.openBinanceHint}</p>
      {desktop ? (
        <ConnectionCode
          uri={session.uri}
          qr={session.qr}
          pending={session.pending}
          error={session.error}
          copied={session.copied}
          onCopy={() => void session.copyUri()}
        />
      ) : null}
      <button type="button" className="text-sm text-muted underline" onClick={() => void session.useInjected()}>
        {copy.useInjected}
      </button>
    </div>
  )
}

export function ConnectButton() {
  const { copy } = useI18n()
  const [open, setOpen] = useState(false)
  const { address, isConnected } = useConnection()
  const identity = useIdentity()
  const preview = usePreview()
  const { disconnect } = useDisconnect()
  const session = useWalletConnectSession()
  const label = !isConnected
    ? copy.connect
    : !preview && identity.handle
      ? displayName(identity.handle)
      : address
        ? shortAddress(address)
        : copy.connected

  return (
    <>
      <Button
        variant={isConnected ? "ghost" : "ink"}
        onClick={() => {
          if (!isConnected && session.phone && !session.insideBinance) {
            void session.openInBinance()
            return
          }
          setOpen(true)
          if (!isConnected && !session.insideBinance) void session.showCode()
        }}
      >
        {isConnected ? label : copy.connect}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-3xl bg-card p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="connect-title" className="serif text-2xl">
                {copy.connect}
              </h2>
              <button type="button" className="text-sm text-muted" onClick={() => setOpen(false)}>
                {copy.close}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">{copy.safetyBody}</p>
            {session.insideBinance ? (
              <Button className="mt-4 w-full" disabled={session.pending} onClick={() => void session.useInjected()}>
                {copy.openBinance}
              </Button>
            ) : (
              <ConnectionCode
                uri={session.uri}
                qr={session.qr}
                pending={session.pending}
                error={session.error}
                copied={session.copied}
                onCopy={() => void session.copyUri()}
              />
            )}
            <button type="button" className="mt-3 text-sm text-muted underline" onClick={() => void session.useInjected()}>
              {copy.useInjected}
            </button>
            {isConnected ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{address ? shortAddress(address) : ""}</span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    disconnect()
                    setOpen(false)
                  }}
                >
                  {copy.disconnect}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

export function SwitchNetwork() {
  const { copy } = useI18n()
  const { switchChain, isPending } = useSwitchChain()
  return (
    <section className="rounded-3xl border border-stamp/30 bg-card p-5">
      <h2 className="serif text-3xl">{copy.wrongNetwork}</h2>
      <p className="mt-2 text-sm text-muted">{copy.wrongNetworkBody}</p>
      <Button className="mt-4" disabled={isPending} onClick={() => switchChain({ chainId: CHAIN_ID })}>
        {copy.switchNetwork}
      </Button>
    </section>
  )
}
