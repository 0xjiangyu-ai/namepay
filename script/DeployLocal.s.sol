// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Namepay} from "../src/Namepay.sol";
import {MockAgentId} from "../test/mocks/MockAgentId.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice 只在 Anvil（chain id 31337）上部署模拟注册表、模拟 USDC 和 Namepay。
/// @dev 使用的是 Anvil 公开默认私钥，任何人都不应该把它拿到主网。
contract DeployLocal is Script {
    /// @dev Anvil 账户 0 的公开测试私钥。不是秘密。
    uint256 internal constant ANVIL_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        require(block.chainid == 31337, "DeployLocal only runs on Anvil chain id 31337");

        address ada = vm.addr(ANVIL_KEY);
        address bao = vm.addr(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        address chao = vm.addr(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);

        vm.startBroadcast(ANVIL_KEY);
        MockAgentId agent = new MockAgentId();
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);
        Namepay namepay = new Namepay(address(agent), address(usdc));

        agent.mint(ada, "ada");
        agent.mint(bao, "bao");
        agent.mint(chao, "chao");
        usdc.mint(ada, 10_000 ether);
        usdc.mint(bao, 10_000 ether);
        usdc.mint(chao, 10_000 ether);
        vm.stopBroadcast();

        console2.log("Namepay", address(namepay));
        console2.log("AgentId", address(agent));
        console2.log("USDC", address(usdc));
        console2.log("ada", ada);
        console2.log("bao", bao);
        console2.log("chao", chao);
    }
}
