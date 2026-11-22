import { type CreateConnectorFn, createConfig, http } from "wagmi"
import { bsc } from "wagmi/chains"
import { injected, walletConnect } from "wagmi/connectors"
import { defineChain, fallback, http as viemHttp } from "viem"
import { CHAIN_ID, readRpcUrls, RPC_URL, WALLETCONNECT_PROJECT_ID } from "./config.ts"
import { createWalletConnectStorage } from "./lib/wcStorage.ts"

const bscReadUrls = readRpcUrls()

const bscChain = defineChain({
  ...bsc,
  rpcUrls: { default: { http: [...bscReadUrls] } },
})

const localChain = defineChain({
  id: CHAIN_ID,
  name: "Namepay local",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL || "http://127.0.0.1:8545"] } },
})

export const chain = CHAIN_ID === bsc.id ? bscChain : localChain

const bscReadTransport = fallback(
  bscReadUrls.map((url) => viemHttp(url, { timeout: 10_000 })),
  { rank: false },
)

const connectors: CreateConnectorFn[] = [
  injected({
    target: {
      id: "binanceApp",
      name: "Binance",
      provider: (target) => {
        const view = target as Window & {
          ethereum?: { isBinance?: boolean }
          binancew3w?: { ethereum?: unknown }
        }
        const found = view.binancew3w?.ethereum ?? (view.ethereum?.isBinance ? view.ethereum : undefined)
        return found as never
      },
    },
  }),
  injected({ shimDisconnect: true }),
]

if (WALLETCONNECT_PROJECT_ID) {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin
  connectors.push(
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      // 官方弹窗在 IndexedDB 出错时是一块黑的，复制也是空的。连接码由我们自己画。
      showQrModal: false,
      storage: createWalletConnectStorage(),
      metadata: {
        name: "Namepay",
        description: "Pay an Agent ID",
        url: origin,
        icons: [`${origin}/favicon.svg`],
      },
    }),
  )
}

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors,
  transports: {
    [chain.id]: chain.id === bsc.id ? bscReadTransport : http(RPC_URL || "http://127.0.0.1:8545"),
  },
})
