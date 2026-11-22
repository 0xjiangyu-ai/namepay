// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice 测试用 Agent ID。对外函数与主网 HandleRegistry 一致，另外提供 mint / move 以便证明结算看的是当前持有人。
/// @dev 主网注册表不可转让。move 只存在于这个模拟合约里。
contract MockAgentId {
    string public constant name = "SPACE ID Agent ID";
    string public constant symbol = "AI";

    uint8 public minLen = 3;
    uint8 public maxLen = 20;

    mapping(address => string) public handleOf;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    error Soulbound();
    error InvalidHandle();
    error Unknown();

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address holder = _owners[tokenId];
        if (holder == address(0)) revert Unknown();
        return holder;
    }

    function ownerOfHandle(string calldata handle) external view returns (address) {
        return _owners[uint256(keccak256(bytes(handle)))];
    }

    function isValidHandle(string calldata handle) external view returns (bool) {
        bytes memory raw = bytes(handle);
        if (raw.length < minLen || raw.length > maxLen) return false;
        for (uint256 i; i < raw.length; ++i) {
            uint8 c = uint8(raw[i]);
            if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39))) return false;
        }
        return true;
    }

    function mint(address to, string calldata handle) external {
        bytes memory raw = bytes(handle);
        if (raw.length < minLen || raw.length > maxLen) revert InvalidHandle();
        for (uint256 i; i < raw.length; ++i) {
            uint8 c = uint8(raw[i]);
            if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39))) revert InvalidHandle();
        }
        if (bytes(handleOf[to]).length != 0) revert InvalidHandle();
        uint256 tokenId = uint256(keccak256(bytes(handle)));
        if (_owners[tokenId] != address(0)) revert InvalidHandle();
        handleOf[to] = handle;
        _owners[tokenId] = to;
        _balances[to] += 1;
    }

    /// @notice 把名字挪到新地址，用来测试“付款跟随 Agent ID，而不是旧钱包”。
    function move(address from, address to) external {
        string memory handle = handleOf[from];
        if (bytes(handle).length == 0) revert Unknown();
        if (bytes(handleOf[to]).length != 0) revert InvalidHandle();
        uint256 tokenId = uint256(keccak256(bytes(handle)));
        handleOf[from] = "";
        handleOf[to] = handle;
        _owners[tokenId] = to;
        _balances[from] -= 1;
        _balances[to] += 1;
    }

    /// @notice 制造 balanceOf > 0 但没有 handle 的异常状态。
    function setBalanceOnly(address account, uint256 amount) external {
        _balances[account] = amount;
    }

    function setBounds(uint8 nextMin, uint8 nextMax) external {
        minLen = nextMin;
        maxLen = nextMax;
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }
}
