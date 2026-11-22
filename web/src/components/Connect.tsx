import { useState } from "react"
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi"
import { CHAIN_ID, WALLETCONNECT_PROJECT_ID } from "../config.ts"
import { useI18n } from "../i18n.tsx"
import { shortAddress } from "../lib/format.ts"
import { displayName } from "../lib/handles.ts"
import { usePreview } from "../preview.tsx"
import { useIdentity } from "../session.tsx"
import { Button } from "./ui.tsx"

export function ConnectButton() {
  const { copy } = useI18n()
  const [open, setOpen] = useState(false)
  const { address, isConnected } = useConnection()
  const identity = useIdentity()
  const preview = usePreview()
  const { disconnect } = useDisconnect()
  // 预览里的 ada.ai 不是真的连上了钱包。按钮只在真实连接后显示名字。
  const label = !isConnected
    ? copy.connect
    : !preview && identity.handle
      ? displayName(identity.handle)
      : address
        ? shortAddress(address)
        : copy.connected

  return (
    <>
      <Button variant={isConnected ? "ghost" : "ink"} onClick={() => setOpen(true)}>
        {isConnected ? label : copy.connect}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-3xl bg-card p-5 shadow-xl"
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
            <div className="mt-4 space-y-2">
              <ConnectorRow idIncludes="injected" title={copy.injected} hint={copy.injectedHint} onDone={() => setOpen(false)} />
              {WALLETCONNECT_PROJECT_ID ? (
                <ConnectorRow
                  idIncludes="walletConnect"
                  title={copy.walletConnect}
                  hint={copy.walletConnectHint}
                  onDone={() => setOpen(false)}
                />
              ) : (
                <p className="rounded-2xl bg-paper px-3 py-3 text-sm text-muted">{copy.wcMissing}</p>
              )}
            </div>
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

function ConnectorRow({
  idIncludes,
  title,
  hint,
  onDone,
}: {
  idIncludes: string
  title: string
  hint: string
  onDone: () => void
}) {
  const { copy } = useI18n()
  const { connectors, connect, isPending, error } = useConnect()
  const connector = connectors.find((item) => item.id.toLowerCase().includes(idIncludes.toLowerCase()))
  return (
    <button
      type="button"
      disabled={!connector || isPending}
      className="w-full rounded-2xl border border-line px-3 py-3 text-left hover:bg-paper disabled:opacity-60"
      onClick={() => {
        if (!connector) return
        connect(
          { connector, chainId: CHAIN_ID },
          { onSuccess: onDone },
        )
      }}
    >
      <span className="block font-medium">{title}</span>
      <span className="block text-sm text-muted">{connector ? hint : copy.noWallet}</span>
      {error ? <span className="mt-1 block text-sm text-brick">{error.message}</span> : null}
    </button>
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
