// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Namepay} from "../src/Namepay.sol";

/// @notice BSC 主网部署。只接受 chain id 56，不会动测试网或本地链。
/// @dev 不要把私钥写进仓库。运行方式见 README。
contract DeployNamepay is Script {
    /// @dev SPACE ID Agent ID，HandleRegistry。
    address public constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    /// @dev Binance-Peg USD Coin，name() = "USD Coin"，symbol() = "USDC"，decimals = 18。
    address public constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;

    function run() external returns (Namepay namepay) {
        require(block.chainid == 56, "Deploy.s.sol only broadcasts on chain id 56");

        address agentId = vm.envOr("AGENT_ID", AGENT_ID);
        address usdc = vm.envOr("USDC", USDC);
        require(agentId == AGENT_ID, "refusing unexpected Agent ID");
        require(usdc == USDC, "refusing unexpected USDC");

        // 私钥只从环境变量读取，脚本不会打印它。
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        namepay = new Namepay(agentId, usdc);
        vm.stopBroadcast();

        console2.log("Namepay", address(namepay));
        console2.log("AgentId", agentId);
        console2.log("USDC", usdc);
    }
}
