// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Namepay} from "../../src/Namepay.sol";

/// @notice 收到 BNB 后尝试再付一张账单。内部失败会被吃掉，用来确认外层只结算一次。
contract SwallowingReentrant {
    Namepay public np;
    uint256 public otherInvoice;
    uint256 public innerFailed;

    function createInvoice(Namepay namepay_) external returns (uint256 id) {
        np = namepay_;
        id = namepay_.createInvoice(address(0), 1 ether, 0, "", false, "trap", "");
    }

    function arm(uint256 invoiceId) external {
        otherInvoice = invoiceId;
    }

    receive() external payable {
        if (otherInvoice == 0 || address(np) == address(0)) return;
        try np.payInvoice{value: msg.value}(otherInvoice) {}
        catch {
            innerFailed = 1;
        }
    }
}

/// @notice 拒绝接收 BNB，付款必须整笔失败。
contract RejectingReceiver {
    function createInvoice(Namepay namepay_) external returns (uint256) {
        return namepay_.createInvoice(address(0), 1 ether, 0, "", false, "nope", "");
    }

    receive() external payable {
        revert("no");
    }
}

/// @notice 用 selfdestruct 把 BNB 塞进没有提款函数的合约。
contract ForceFeed {
    constructor(address payable to) payable {
        selfdestruct(to);
    }
}

contract FakeAgentId {
    function name() external pure returns (string memory) {
        return "Not the registry";
    }

    function symbol() external pure returns (string memory) {
        return "NO";
    }
}
