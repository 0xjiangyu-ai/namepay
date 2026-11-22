#!/usr/bin/env bash
# 在仓库根目录运行。只验证，不部署、不花费主网资金。
set -euo pipefail

if [[ -z "${NAMEPAY_ADDRESS:-}" ]]; then
  echo "请设置 NAMEPAY_ADDRESS 为已部署的 Namepay 地址" >&2
  exit 1
fi
if [[ -z "${ETHERSCAN_API_KEY:-}" ]]; then
  echo "请设置 ETHERSCAN_API_KEY。Foundry 1.9 使用 Etherscan API v2，同一把钥匙可验证 chain id 56。" >&2
  exit 1
fi

# cast abi-encode "constructor(address,address)" \
#   0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F \
#   0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
ARGS=0x00000000000000000000000060b9262456de011f7d15a54cdd8c48baaa8b022f0000000000000000000000008ac76a51cc950d9822d68b83fe1ad97b32cd580d

forge verify-contract \
  --chain 56 \
  --watch \
  --compiler-version 0.8.28 \
  --num-of-optimizations 200 \
  --evm-version shanghai \
  --constructor-args "$ARGS" \
  "$NAMEPAY_ADDRESS" \
  src/Namepay.sol:Namepay
