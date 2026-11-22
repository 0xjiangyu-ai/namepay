# Namepay

付给一个 Agent ID 的**当前链上持有人**，不是付给一个币安账户，也不是付给一个可能过时的地址。

主网合约已经部署在 BNB Smart Chain（chain id 56）：`0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD`。现场结账只调用这份合约上已有的 `tip`（BNB）和 `tipToken`（USDC）。资金在同一笔交易里转给 `ownerOf` 读到的当前持有人。合约不托管。不要再部署一份，也不要在仓库里放私钥。

公开预览（不签名）：<https://namepay-bangkok.deed.page/preview/booth/>

| 路径 | 谁用 | 会不会上链 |
| --- | --- | --- |
| `/booth` | 展台屏幕 | 会。付款人自己的钱包签名并广播 |
| `/checkout/<name>.ai` | 扫码的付款人 | 同上。收据上是真实交易哈希 |
| `/preview/booth` | 不连钱包的走查 | 不会签名、不会广播 |
| `/preview/checkout/<name>.ai` | 走查里的付款页 | 收据上的哈希是模拟的，并标明未广播 |

`ada.ai` 和 `bao.ai` 是预览里的账单样本。`tipoff.ai` 没有注册，用来看“打赏已关闭”时页面怎么说。已经注册的名字（包括链上的 bao.ai）会读当前持有人；样本持有人只在链上没有这个名字、或当时读不到链时出现。真正转账只发生在 `/booth` 和 `/checkout`。

## 曼谷展台

1. 收款电脑打开 `/booth`。填一个已注册、且没有关闭打赏的 Agent ID，选金额和 BNB 或 USDC，把二维码投出来。二维码、金额和名字记在这个浏览器里，刷新还在。
2. 付款人用另一部手机扫码。这个钱包必须已经持有**另一个** Agent ID（在币安 App 里领取），并留一点 BNB 作 gas。不能给自己的名字付款。没有 Agent ID 的钱包会被合约拒绝。
3. 连接方式只有两种：浏览器里的注入钱包，或 WalletConnect。页面不会要 Agentic Wallet 配对码、助记词或私钥。
4. 付款页会写出当前持有人地址，并写明这不是币安账户。钱包里确认的是现有合约的 `tip` 或 `tipToken`。
5. 选 USDC 时要确认两次：先按这笔金额授权，再支付。授权成功还不是收据。收据只在支付交易确认后出现，上面有交易哈希。
6. 展台的入账来自合约里的打赏记录，所以换一台手机付款、再刷新展台，列表还在。最近大约 4500 个区块里能对上的交易，会带上哈希。

如果这个名字的应付档案把打赏关掉了，展台和结账页会直接说明付不了，不会打开一个注定失败的钱包确认。没开过档案的名字仍然可以收款。

Namepay 是自托管支付工具：Agent ID 持有人可以开通应付档案、开账单、收款；另一位持有人可以付款或打赏。资金在同一笔交易里转给这个名字的**当前持有人**，合约不保管用户资金。支付指定账单或购买通行证时，会记下一张**不能转让、绑定在付款人 Agent ID 上**的访问通行证。

这不是投资产品，不提供收益。数字资产有风险，支付不可撤销。每一笔转账都由你在自己的钱包里确认。

English documentation starts below.

## 本地运行

```bash
# 合约测试（需要 Foundry）
forge test

# 前端
cd web
npm install
cp .env.example .env
npm run dev
```

前端默认在 http://127.0.0.1:41731 。主网合约是 `0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD`（chain id 56）。不连钱包也可以打开 `/preview` 把每个界面走一遍，预览不会签名、也不会发交易。

## Public preview

Walkthrough, no wallet: <https://namepay-bangkok.deed.page/preview/booth/>

Live paths on that host are `/booth` and `/checkout/<name>.ai`. Preview paths under `/preview` use the same screens and do not sign or broadcast. The live contract is `0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD` on BNB Smart Chain (chain id 56). Checkout pays with the existing `tip` and `tipToken` functions, so BNB or USDC goes to the wallet that currently holds the Agent ID. That wallet is the on-chain holder, not a Binance account. Do not deploy another contract.

## Booth demo

1. On the booth laptop, open `/booth`. Enter a registered Agent ID that still accepts tips, pick BNB or USDC, and show the QR. The form is kept in this browser, so a refresh restores it.
2. The payer scans with a different phone. That wallet must already hold a different Agent ID and a little BNB for gas. The contract rejects a wallet with no Agent ID, and it rejects paying your own name.
3. Connect an injected wallet or WalletConnect. The page does not ask for an Agentic Wallet pairing code, a seed phrase, or a private key.
4. The checkout page shows the current holder and says this is not a Binance account. The wallet confirms `tip` (BNB, with value) or `tipToken` (USDC).
5. USDC is two confirmations: approve the exact amount, then pay. The approval is not the receipt. The receipt appears after the payment transaction, with its hash.
6. The booth reads tips from the contract, so the incoming list survives a refresh and does not depend on the payer’s phone. A recent log lookup adds the transaction hash when the public RPC allows it. If a read fails, the last list saved in that browser stays on screen.

If the payable profile has tips closed, the booth and the checkout explain that and do not open a wallet confirmation that would revert. A name with no profile can still be paid. In the preview, `tipoff.ai` is an unregistered sample with tips closed. `ada.ai` and `bao.ai` keep the scripted invoices. When a name is registered, preview and live both show that chain holder; the sample holder is only used when the name is not registered or the registry could not be read. Only live checkout broadcasts.

## What it is

Namepay is an on-chain commerce primitive for Agent IDs (`name.ai`):

1. An Agent ID holder opens a payable profile and creates invoices (amount, BNB or USDC, memo, deadline, optional payer restriction, optional access pass).
2. Another Agent ID holder pays that invoice or tips a name they were given. Funds move to `ownerOf(tokenId)` at that moment.
3. Some payments mint an access pass bound to the payer’s Agent ID. Using the pass checks that same token id.
4. Recipients share `/pay/<id>` or `/to/<name>.ai`. The payer opens a name they already have. There is no directory.

The first on-chain action can be activating a profile (an empty bio is fine) or creating a zero-amount invoice.

## Why Agent ID is the product

Agent ID is the account, not a badge checked once at the door.

| Step | What the contract actually does |
| --- | --- |
| Identity | `balanceOf(caller) > 0`, then `handleOf(caller)`, then `ownerOf(keccak256(handle)) == caller`. A balance without a handle is rejected. |
| Records | Profiles, invoices, tips, and passes are keyed by `tokenId = uint256(keccak256(bytes(handle)))`. The handle stored on-chain has no `.ai` suffix. The interface adds `.ai` for display. |
| Payment | `payInvoice`, `tip`, and `buyPass` read `ownerOf` at settlement and transfer BNB or USDC directly to that address. A cached wallet is never the payee. |
| Restriction | An invoice may store the payer’s token id. After a test-only move of the identity, the new holder can pay and the old wallet cannot. |
| Access | A pass stores the payer’s token id. `usePass` requires the caller to currently hold that token id. There is no transfer function. |

`register` and `adminRegister` are intentionally absent from the app. Agent IDs are claimed in the Binance App: Wallet → homepage banner → Agent ID. This site has no claim button.

The live registry is [HandleRegistry](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) (`SPACE ID Agent ID`, symbol `AI`) at `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` on chain id 56. Handles are lowercase `a-z0-9`, length 3–20 today (`minLen` / `maxLen`). `ownerOfHandle` returns `address(0)` when the name is unknown. `handleOf` returns `""` when the address has none. The NFT is soulbound (`Soulbound` on transfer). `tokenId` was checked against the live handle `zap`.

Names that are already registered stay payable even if the registry later tightens `minLen` / `maxLen`. `isValidHandle` is still called so unknown input can be reported as invalid rather than merely missing.

## Tokens

| Asset | Address | Decimals | Notes |
| --- | --- | --- | --- |
| Native coin | `address(0)` in invoices | 18 | The chain’s native coin. The wallet shows it as BNB on chain id 56. |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | 18 | Canonical Binance-Peg USD Coin on BSC. `name()` returns `USD Coin`, `symbol()` returns `USDC`. Circle’s native USDC list does not include BNB Smart Chain, so this pegged contract is the one wallets on BSC use. |

No other token is accepted. USDC payments use `transferFrom` for the exact invoice amount. The interface asks for that amount, not an unlimited approval. The spender is the Namepay contract; the recipient is the Agent ID holder, not Namepay.

## Architecture

```
Browser (Vite + React + wagmi/viem)
  injected wallet  |  WalletConnect (only if a project id is set)
        |
        v
Namepay (immutable, no owner)
  ├── IAgentId  →  HandleRegistry (existing, not ours)
  └── USDC      →  Binance-Peg USD Coin
```

There is no backend, no session store, and no relayer. Reads and writes go to the chain from the browser. History is stored on Namepay (latest 20 ids per list) so the app does not need an indexer.

Passes are records inside Namepay rather than a separate ERC-721. A transferable token could leave the Agent ID. A record with no transfer function cannot.

Product choices, also enforced in tests:

- You cannot pay your own Agent ID.
- A zero amount is allowed, so the first try does not need funds. It does not mint a reward or pay the caller.
- Tips work for any registered name. If that name has an active profile with tips closed, tips revert and invoices still work.
- If a BNB recipient rejects the transfer, or a USDC transfer returns false, the whole transaction reverts and the invoice stays unpaid.
- Reentrancy during the outgoing call cannot settle a second invoice with the same value.

## Red lines

- No Agentic Wallet QR login, no pairing-code field, no seed phrase, no private key, no API secret. Wallet connection is an injected wallet or WalletConnect. A public WalletConnect project id is built in so a static booth build can open the dialog without a secret in the repo; it cannot move funds. Set `VITE_WALLETCONNECT_PROJECT_ID` to use a different id. Inside the Binance Wallet browser, use the injected wallet.
- Every transfer is a wallet transaction the user confirms. There is no scheduled pull and no bundled extra transfer.
- The contract does not take custody. There is no pot to sweep.
- The product name is Namepay. It does not use “Binance” or “BNB” as a brand. “Agent ID” appears only as a description. “BNB” appears only as the native asset on chain id 56.
- No yield, no directory, no browse-all-names page, no wash-trade reward, no faucet, no invite scheme.
- The app never calls `register`.

## Owner permissions

Namepay has **no owner and no admin**.

After deployment, nobody can:

- pause or unpause
- change a fee (there is no fee)
- freeze a user
- mint or revoke a pass, except the payer minting one by paying
- transfer a pass
- replace the Agent ID registry or the USDC address (both are `immutable`)
- withdraw BNB or tokens

There is no `owner()`, `withdraw()`, `pause()`, `sweep()`, or `setFee()`. Direct BNB transfers hit `receive()` and revert. BNB forced in by `selfdestruct` stays stuck. That is deliberate: a withdraw function would be a way to take funds. Stuck dust is not stealable.

The Agent ID registry itself has an owner. That owner is not Namepay’s, and Namepay does not call the registry’s admin functions.

## Run the tests

```bash
forge test
```

`forge test` does not need a network. One extra test reads the live registry and is skipped unless you opt in:

```bash
NAMEPAY_FORK_TEST=1 forge test --match-contract AgentIdForkTest -vv
```

That test checks `zap`: `ownerOfHandle`, `handleOf`, `balanceOf > 0`, and `tokenId == uint256(keccak256("zap"))`.

Covered cases include: non-holders rejected; settlement to the current holder after the identity moves; payer restrictions bound to the token id; deadlines; cancellation; self-payment; closed tips; USDC pulling the exact amount and leaving Namepay’s balance at zero; passes following the Agent ID rather than the old wallet; rejecting recipients; reentrancy; failed `transferFrom`; no owner and no sweep; constructor rejection of the wrong registry or a 6-decimal token.

## Run the app

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:41731 .

| Variable | Purpose |
| --- | --- |
| `VITE_CHAIN_ID` | `56` for BNB Smart Chain. `31337` for the local Anvil script. |
| `VITE_RPC_URL` | Default `https://bsc-dataseed.bnbchain.org`. |
| `VITE_NAMEPAY_ADDRESS` | Live Namepay on chain id 56: `0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD`. The frontend uses this if the variable is empty. |
| `VITE_AGENT_ID_ADDRESS` | Defaults to the live registry. |
| `VITE_USDC_ADDRESS` | Defaults to Binance-Peg USDC. |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional. A public project id is already built in so WalletConnect works on a static deploy. Set this to replace it. The example file is blank. Do not commit a private key or an API secret. |

`npm run build` writes a static site to `web/dist`. Serve that directory on any static host. Do not add a backend.

Preview routes, all unsigned. Payments stay in this browser (`localStorage`), including after a refresh, and a second tab on the same origin sees them. `ada.ai`, `bao.ai`, and `tipoff.ai` still walk offline if the registry cannot be read. Registered names resolve with a read-only call; the receipt hash is simulated and is not a BscScan transaction.

- `/preview` walkthrough index
- `/preview/booth` booth QR, simulated checkout, incoming list
- `/preview/desk` ada.ai’s desk
- `/preview/empty` a wallet with no Agent ID
- `/preview/pay/1` bao.ai’s open invoice
- `/preview/to/bao.ai` tip and pass
- `/preview/to/missing.ai` unknown name
- `/preview/checkout/tipoff.ai?amount=0.05&token=bnb&memo=closed` tips closed

The preview banner can mark the next action as a wallet rejection so that state is visible.

## Local chain

Anvil account 0’s private key below is the public development key published by Foundry. Never use it on chain id 56.

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
# another terminal, from the repo root
bash script/local.sh
```

The script deploys a mock registry, mock 18-decimal USDC, and Namepay, then mints `ada`, `bao`, and `chao` to Anvil accounts 0, 1, and 2 and gives them mock USDC. It refuses any chain id other than 31337. Point `web/.env` at `http://127.0.0.1:8545`, chain id `31337`, and the logged addresses. Import the Anvil accounts into a browser wallet only on that local network.

## Live deployment

Namepay is on BNB Smart Chain (chain id 56).

| Item | Value |
| --- | --- |
| Contract | `0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD` |
| Deploy transaction | `0xac6854436f0904388e799b9c99d84f226bb5014f614ac861df8a39840d5c1a38` |
| Factory | Nick CREATE2 `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| Salt | `keccak256("Namepay.v1")` = `0x9c479b90f749f22465a174563de490f75ce2a1d4525f856f9d12449d574b504a` |
| Sourcify | [exact match](https://sourcify.dev/56/0xE762448Cd6a9887e00c380de3dC6DaAE06aB2FeD) |

Runtime bytecode matches this repo once the immutable `agentRegistry` and `usdc` addresses are filled in. Do not deploy a second copy.

## Deploy and verify on BNB Smart Chain

This repository does not contain a mainnet key and does not broadcast. You do that, with your own key, after you have read the contract.

Compiler settings in `foundry.toml` (these must match verification):

| Setting | Value |
| --- | --- |
| Solidity | `0.8.28` (exact) |
| Optimizer | enabled |
| Optimizer runs | `200` |
| viaIR | `false` |
| EVM version | `shanghai` |
| Bytecode hash | `ipfs` |

Constructor:

```solidity
constructor(address agentId, address usdc)
```

| Argument | Value |
| --- | --- |
| `agentId` | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| `usdc` | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |

ABI-encoded constructor arguments:

```text
0x00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f0000000000000000000000008ac76a51cc950d9822d68b83fe1ad97b32cd580d
```

The constructor checks that the registry’s `name()` is `SPACE ID Agent ID`, its `symbol()` is `AI`, and the token’s `decimals()` is 18. A wrong address fails deployment instead of shipping a miswired contract.

From the repo root:

```bash
export PRIVATE_KEY=0xYOUR_KEY
forge script script/Deploy.s.sol:DeployNamepay \
  --rpc-url https://bsc-dataseed.bnbchain.org \
  --broadcast \
  --slow
```

`Deploy.s.sol` reverts unless `block.chainid == 56`, and it reverts if `AGENT_ID` or `USDC` are overridden to anything else. The key is read from `PRIVATE_KEY` and is not printed.

Then, with an Etherscan API v2 key (the same key works for chain id 56):

```bash
export ETHERSCAN_API_KEY=YOUR_KEY
export NAMEPAY_ADDRESS=0xDEPLOYED
bash script/verify.sh
```

`script/verify.sh` calls:

```bash
forge verify-contract \
  --chain 56 \
  --watch \
  --compiler-version 0.8.28 \
  --num-of-optimizations 200 \
  --evm-version shanghai \
  --constructor-args 0x00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f0000000000000000000000008ac76a51cc950d9822d68b83fe1ad97b32cd580d \
  "$NAMEPAY_ADDRESS" \
  src/Namepay.sol:Namepay
```

Run it from the repo root so `foundry.toml` supplies optimizer enabled, `via_ir = false`, and `bytecode_hash = ipfs`. Do not pass `--via-ir`.

The live address above is already verified on Sourcify. The frontend uses it when `VITE_NAMEPAY_ADDRESS` is unset.

Venue checkout is `/booth` (preview: `/preview/booth`). It shows a QR for `/checkout/<name>.ai`. Paying calls the existing `tip` or `tipToken` function, so BNB or USDC goes to the wallet that currently holds that Agent ID. The payer’s receipt shows the transaction hash. The booth lists those tips from the contract, so a refresh does not clear them. `/preview/booth` runs the same screens without signing. See “Booth demo” above.

Only this Namepay address should be submitted. Interacting addresses are the `msg.sender` of those transactions, and every core action requires that address to hold an Agent ID. BNB value is `msg.value`. USDC moves inside the same transaction from the payer to the current holder.

## Layout

```text
src/Namepay.sol                 contract
src/interfaces/IAgentId.sol     registry surface used by Namepay
script/Deploy.s.sol             chain id 56 only
script/DeployLocal.s.sol        Anvil only
script/verify.sh                BscScan / Etherscan v2 verification
script/local.sh                 local broadcast
test/Namepay.t.sol              unit tests and the optional fork test
test/mocks/                     registry, USDC, reentrancy fixtures
web/                            static frontend
lib/forge-std/                  vendored, so forge test needs no extra install
```

## License

MIT. See `LICENSE`.
