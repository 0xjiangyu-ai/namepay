// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IAgentId
/// @notice SPACE ID Agent ID（已验证合约 HandleRegistry）里 Namepay 真正调用的函数。
/// @dev 链上地址：0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F（BNB Chain，chain id 56）。
///      集合名 "SPACE ID Agent ID"，符号 "AI"。tokenId = uint256(keccak256(bytes(handle)))。
///      handle 不含 ".ai"，只允许小写 a-z 与数字。该 NFT 不可转让（转移会 revert Soulbound）。
///      本接口故意不包含 register / adminRegister：Namepay 永不铸造、也不帮用户领取 Agent ID。
interface IAgentId {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);

    /// @notice 官方持有判断：返回值 > 0 表示该地址持有 Agent ID。
    function balanceOf(address owner) external view returns (uint256);

    /// @notice 标准 ERC-721。token 不存在时 revert。
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice handle → 当前持有人。未注册时返回 address(0)，不 revert。
    function ownerOfHandle(string calldata handle) external view returns (address);

    /// @notice 地址 → handle。没有名字时返回空字符串。一个地址最多一个 handle。
    function handleOf(address owner) external view returns (string memory);

    /// @notice 按注册表当前的长度上下限与字符集检查 handle。已注册的旧名字可能在界限收紧后返回 false。
    function isValidHandle(string calldata handle) external view returns (bool);
}

/// @notice 只保留 Namepay 需要的 ERC-20 表面。官方 BSC USDC 为 18 位小数。
interface IERC20Minimal {
    function decimals() external view returns (uint8);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
