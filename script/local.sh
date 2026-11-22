#!/usr/bin/env bash
# 只在本机 Anvil 上部署模拟注册表。不要把这里的测试私钥用于主网。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! cast chain-id --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1; then
  echo "请先在另一个终端运行: anvil --host 127.0.0.1 --port 8545 --chain-id 31337" >&2
  exit 1
fi

CHAIN="$(cast chain-id --rpc-url http://127.0.0.1:8545)"
if [[ "$CHAIN" != "31337" ]]; then
  echo "拒绝：RPC 的 chain id 是 $CHAIN，不是 Anvil 的 31337" >&2
  exit 1
fi

forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast
