// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Namepay} from "../src/Namepay.sol";
import {IAgentId} from "../src/interfaces/IAgentId.sol";
import {MockAgentId} from "./mocks/MockAgentId.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {SwallowingReentrant, RejectingReceiver, ForceFeed, FakeAgentId} from "./mocks/Receivers.sol";

contract NamepayTest is Test {
    MockAgentId internal agent;
    MockERC20 internal usdc;
    Namepay internal namepay;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");

    function setUp() public {
        agent = new MockAgentId();
        usdc = new MockERC20("USD Coin", "USDC", 18);
        namepay = new Namepay(address(agent), address(usdc));

        agent.mint(alice, "alice");
        agent.mint(bob, "bob");
        agent.mint(carol, "carol");

        usdc.mint(alice, 1_000 ether);
        usdc.mint(bob, 1_000 ether);
        usdc.mint(carol, 1_000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(dave, 50 ether);
    }

    function testSelectorsMatchVerifiedRegistry() public pure {
        assertEq(IAgentId.balanceOf.selector, bytes4(hex"70a08231"));
        assertEq(IAgentId.ownerOf.selector, bytes4(hex"6352211e"));
        // 与主网已验证 ABI 的选择器对齐：ownerOfHandle = 0x1da94fb4，handleOf = 0xc50a1514。
        assertEq(IAgentId.ownerOfHandle.selector, bytes4(hex"1da94fb4"));
        assertEq(IAgentId.handleOf.selector, bytes4(hex"c50a1514"));
        assertEq(IAgentId.isValidHandle.selector, bytes4(hex"3ff4dbc2"));
    }

    function testNormalizeHandle() public view {
        assertEq(namepay.normalizeHandle("Alice.AI"), "alice");
        assertEq(namepay.normalizeHandle("  bob.ai "), "bob");
        assertEq(namepay.normalizeHandle("CAROL"), "carol");
        assertEq(namepay.normalizeHandle("ada.AI"), "ada");
        assertEq(namepay.normalizeHandle(".ai"), "");
        assertEq(namepay.normalizeHandle("a.b.ai"), "a.b");
        assertEq(namepay.normalizeHandle("\talice.ai\n"), "alice");
    }

    function testNonHolderCannotUseCoreActions() public {
        vm.startPrank(dave);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.setProfile("hi", true, false, address(0), 0, "");

        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.createInvoice(address(0), 0, 0, "", false, "", "");

        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.tip("bob", "hi");

        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.tipToken("bob", 1 ether, "hi");

        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.buyPass("bob");
        vm.stopPrank();

        uint256 id = _invoice(bob, address(0), 0, "", false);
        vm.prank(dave);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.payInvoice(id);

        vm.prank(dave);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.cancelInvoice(id);

        vm.prank(dave);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.usePass(1, "enter");
    }

    function testBalanceWithoutHandleIsNotEnough() public {
        agent.setBalanceOnly(dave, 1);
        vm.prank(dave);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.setProfile("", true, false, address(0), 0, "");
        (bool holds,,) = namepay.identityOf(dave);
        assertFalse(holds);
    }

    function testProfileActivationIsCheapAndUpdatable() public {
        vm.prank(bob);
        namepay.setProfile("desk", true, false, address(0), 0, "");
        (bool active, bool tipsOpen,,,,, string memory bio,) = namepay.profile(_id("bob"));
        assertTrue(active);
        assertTrue(tipsOpen);
        assertEq(bio, "desk");

        vm.prank(bob);
        namepay.setProfile("updated", false, true, address(0), 0, "door");
        (active, tipsOpen,,,,, bio,) = namepay.profile(_id("bob"));
        assertTrue(active);
        assertFalse(tipsOpen);
        assertEq(bio, "updated");
        (,,, address passToken, uint256 price,,, string memory label) = namepay.profile(_id("bob"));
        assertEq(passToken, address(0));
        assertEq(price, 0);
        assertEq(label, "door");

        uint256 id = _invoice(bob, address(0), 0, "", false);
        vm.prank(alice);
        vm.expectRevert(Namepay.NotRecipient.selector);
        namepay.cancelInvoice(id);

        vm.prank(alice);
        namepay.setProfile("alice-desk", true, false, address(0), 0, "");
        (bool aliceActive,,,,,, string memory aliceBio,) = namepay.profile(_id("alice"));
        assertTrue(aliceActive);
        assertEq(aliceBio, "alice-desk");
        (,,,,,, bio,) = namepay.profile(_id("bob"));
        assertEq(bio, "updated");
    }

    function testBnbInvoiceSettlesToCurrentHolder() public {
        uint256 id = _invoice(bob, address(0), 1 ether, "", false);
        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(id);

        Namepay.InvoiceView memory inv = namepay.invoice(id);
        assertTrue(inv.paid);
        assertEq(inv.paidTo, bob);
        assertEq(inv.payerAgentId, _id("alice"));
        assertEq(bob.balance, 101 ether);
        assertEq(alice.balance, 99 ether);
        assertEq(address(namepay).balance, 0);
    }

    function testPaymentFollowsAgentIdAfterMove() public {
        uint256 id = _invoice(bob, address(0), 1 ether, "", false);
        agent.move(bob, dave);

        vm.prank(bob);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.cancelInvoice(id);

        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(id);

        assertEq(dave.balance, 51 ether);
        assertEq(bob.balance, 100 ether);
        assertEq(namepay.invoice(id).paidTo, dave);
        assertEq(address(namepay).balance, 0);
    }

    function testUsdcPullsExactAmountAndLeavesNothingInProtocol() public {
        uint256 id = _invoice(bob, address(usdc), 25 ether, "", false);
        vm.prank(alice);
        usdc.approve(address(namepay), 400 ether);

        vm.prank(alice);
        namepay.payInvoice(id);

        assertEq(usdc.balanceOf(bob), 1_025 ether);
        assertEq(usdc.balanceOf(alice), 975 ether);
        assertEq(usdc.balanceOf(address(namepay)), 0);
        assertEq(usdc.allowance(alice, address(namepay)), 375 ether);
        assertEq(address(namepay).balance, 0);
    }

    function testZeroAmountInvoiceCanMintPass() public {
        uint256 id = _invoice(bob, address(0), 0, "", true);
        vm.prank(alice);
        namepay.payInvoice(id);

        assertTrue(namepay.invoice(id).paid);
        assertEq(namepay.invoice(id).paidTo, alice == bob ? address(0) : bob);
        assertEq(alice.balance, 100 ether);
        assertEq(namepay.passCount(), 1);
        Namepay.PassView memory pass = namepay.passInfo(1);
        assertEq(pass.holderAgentId, _id("alice"));
        assertEq(pass.issuerAgentId, _id("bob"));
        assertEq(pass.holderHandle, "alice");
        assertEq(pass.label, "gate");
        assertEq(pass.invoiceId, id);
    }

    function testRestrictedPayerIsTheAgentId() public {
        uint256 id = _invoice(bob, address(0), 1 ether, "Carol.AI", false);
        assertEq(namepay.invoice(id).restrictedPayerAgentId, _id("carol"));
        assertEq(namepay.invoice(id).restrictedPayerHandle, "carol");

        vm.prank(alice);
        vm.expectRevert(Namepay.PayerNotAllowed.selector);
        namepay.payInvoice{value: 1 ether}(id);

        agent.move(carol, dave);
        vm.prank(carol);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.payInvoice{value: 1 ether}(id);

        vm.prank(dave);
        namepay.payInvoice{value: 1 ether}(id);
        assertEq(namepay.invoice(id).payerAgentId, _id("carol"));
        assertEq(bob.balance, 101 ether);
    }

    function testDeadline() public {
        vm.prank(bob);
        vm.expectRevert(Namepay.DeadlineInPast.selector);
        namepay.createInvoice(address(0), 1 ether, uint64(block.timestamp), "", false, "", "");

        uint64 deadline = uint64(block.timestamp + 10);
        vm.prank(bob);
        uint256 id = namepay.createInvoice(address(0), 1 ether, deadline, "", false, "due", "");

        vm.warp(deadline);
        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(id);
        assertTrue(namepay.invoice(id).paid);

        vm.prank(bob);
        uint256 late = namepay.createInvoice(address(0), 1 ether, uint64(block.timestamp + 5), "", false, "", "");
        vm.warp(block.timestamp + 6);
        vm.prank(alice);
        vm.expectRevert(Namepay.InvoiceExpired.selector);
        namepay.payInvoice{value: 1 ether}(late);
        assertFalse(namepay.invoice(late).paid);
    }

    function testCancelRules() public {
        uint256 id = _invoice(bob, address(0), 1 ether, "", false);
        vm.prank(carol);
        vm.expectRevert(Namepay.NotRecipient.selector);
        namepay.cancelInvoice(id);

        vm.prank(bob);
        namepay.cancelInvoice(id);
        vm.prank(alice);
        vm.expectRevert(Namepay.InvoiceAlreadyCancelled.selector);
        namepay.payInvoice{value: 1 ether}(id);

        uint256 paid = _invoice(bob, address(0), 0, "", false);
        vm.prank(alice);
        namepay.payInvoice(paid);
        vm.prank(bob);
        vm.expectRevert(Namepay.AlreadyPaid.selector);
        namepay.cancelInvoice(paid);
    }

    function testCannotPayYourself() public {
        uint256 id = _invoice(bob, address(0), 0, "", false);
        vm.prank(bob);
        vm.expectRevert(Namepay.SelfPayment.selector);
        namepay.payInvoice(id);

        vm.prank(bob);
        vm.expectRevert(Namepay.SelfPayment.selector);
        namepay.tip("bob.ai", "");

        vm.prank(bob);
        vm.expectRevert(Namepay.SelfPayment.selector);
        namepay.createInvoice(address(0), 0, 0, "BOB", false, "", "");
    }

    function testTipsFollowTheNameAndCanBeClosed() public {
        vm.prank(alice);
        namepay.tip{value: 2 ether}("Bob.AI", "tea");
        assertEq(bob.balance, 102 ether);
        assertEq(address(namepay).balance, 0);
        Namepay.TipView memory sent = namepay.tipInfo(1);
        assertEq(sent.toHandle, "bob");
        assertEq(sent.fromHandle, "alice");
        assertEq(sent.to, bob);
        assertEq(sent.amount, 2 ether);

        vm.prank(bob);
        namepay.setProfile("closed", false, false, address(0), 0, "");
        vm.prank(alice);
        vm.expectRevert(Namepay.TipsClosed.selector);
        namepay.tip{value: 1 ether}("bob", "more");

        // 关掉打赏不影响已经开出的账单。
        uint256 id = _invoice(bob, address(0), 1 ether, "", false);
        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(id);
        assertEq(bob.balance, 103 ether);
    }

    function testBuyPassSettlesToCurrentHolder() public {
        vm.prank(bob);
        namepay.setProfile("studio", true, true, address(usdc), 8 ether, "studio-door");
        vm.prank(alice);
        usdc.approve(address(namepay), 8 ether);

        agent.move(bob, dave);
        vm.prank(alice);
        namepay.buyPass("bob.ai");

        assertEq(usdc.balanceOf(dave), 8 ether);
        assertEq(usdc.balanceOf(bob), 1_000 ether);
        assertEq(usdc.balanceOf(address(namepay)), 0);
        Namepay.PassView memory pass = namepay.passInfo(1);
        assertEq(pass.holderAgentId, _id("alice"));
        assertEq(pass.issuerHandle, "bob");
        assertEq(pass.invoiceId, 0);
        assertEq(pass.label, "studio-door");
        assertEq(pass.price, 8 ether);
    }

    function testPassIsBoundToAgentIdAndHasNoTransfer() public {
        _invoice(bob, address(0), 0, "", true);
        vm.prank(alice);
        namepay.payInvoice(1);

        vm.prank(alice);
        namepay.usePass(1, "enter");
        vm.prank(bob);
        vm.expectRevert(Namepay.NotPassHolder.selector);
        namepay.usePass(1, "enter");

        agent.move(alice, dave);
        vm.prank(alice);
        vm.expectRevert(Namepay.NoAgentId.selector);
        namepay.usePass(1, "again");

        vm.prank(dave);
        namepay.usePass(1, "again");
        Namepay.PassView memory pass = namepay.passInfo(1);
        assertEq(pass.holderAgentId, _id("alice"));
        assertEq(pass.uses, 2);
        assertEq(pass.lastAction, "again");

        (bool ok,) =
            address(namepay).call(abi.encodeWithSignature("transferFrom(address,address,uint256)", alice, bob, 1));
        assertFalse(ok);
        (ok,) =
            address(namepay).call(abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", alice, bob, 1));
        assertFalse(ok);
    }

    function testRejectingRecipientLeavesInvoiceUnpaid() public {
        RejectingReceiver sink = new RejectingReceiver();
        agent.mint(address(sink), "sink");
        vm.prank(address(sink));
        uint256 id = sink.createInvoice(namepay);

        uint256 before = alice.balance;
        vm.prank(alice);
        vm.expectRevert(Namepay.PaymentFailed.selector);
        namepay.payInvoice{value: 1 ether}(id);
        assertFalse(namepay.invoice(id).paid);
        assertEq(alice.balance, before);
        assertEq(address(namepay).balance, 0);
    }

    function testReentrancyCannotSettleTwice() public {
        SwallowingReentrant trap = new SwallowingReentrant();
        agent.mint(address(trap), "trap");
        vm.prank(address(trap));
        uint256 trapInvoice = trap.createInvoice(namepay);
        uint256 other = _invoice(bob, address(0), 1 ether, "", false);
        trap.arm(other);

        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(trapInvoice);

        assertTrue(namepay.invoice(trapInvoice).paid);
        assertFalse(namepay.invoice(other).paid);
        assertEq(trap.innerFailed(), 1);
        assertEq(address(trap).balance, 1 ether);
        assertEq(bob.balance, 100 ether);
        assertEq(address(namepay).balance, 0);
        assertEq(alice.balance, 99 ether);
    }

    function testErc20HookCannotReenter() public {
        uint256 id = _invoice(bob, address(usdc), 5 ether, "", false);
        uint256 other = _invoice(bob, address(usdc), 5 ether, "", false);
        vm.prank(alice);
        usdc.approve(address(namepay), 5 ether);
        usdc.setHook(address(namepay), abi.encodeWithSelector(Namepay.payInvoice.selector, other));

        vm.prank(alice);
        vm.expectRevert(Namepay.TransferFailed.selector);
        namepay.payInvoice(id);
        assertFalse(namepay.invoice(id).paid);
        assertFalse(namepay.invoice(other).paid);
        assertEq(usdc.balanceOf(address(namepay)), 0);
        assertEq(usdc.balanceOf(alice), 1_000 ether);
    }

    function testTransferFromFalseOrMissingAllowance() public {
        uint256 id = _invoice(bob, address(usdc), 1 ether, "", false);
        vm.prank(alice);
        vm.expectRevert(Namepay.TransferFailed.selector);
        namepay.payInvoice(id);

        vm.prank(alice);
        usdc.approve(address(namepay), 1 ether);
        usdc.setReturnFalse(true);
        vm.prank(alice);
        vm.expectRevert(Namepay.TransferFailed.selector);
        namepay.payInvoice(id);
        assertFalse(namepay.invoice(id).paid);
        assertEq(usdc.balanceOf(bob), 1_000 ether);
    }

    function testWrongValueAndDisallowedToken() public {
        uint256 id = _invoice(bob, address(0), 1 ether, "", false);
        vm.prank(alice);
        vm.expectRevert(Namepay.WrongValue.selector);
        namepay.payInvoice{value: 2 ether}(id);
        vm.prank(alice);
        vm.expectRevert(Namepay.WrongValue.selector);
        namepay.payInvoice(id);
        assertEq(alice.balance, 100 ether);

        uint256 usdcId = _invoice(bob, address(usdc), 1 ether, "", false);
        vm.prank(alice);
        usdc.approve(address(namepay), 1 ether);
        vm.prank(alice);
        vm.expectRevert(Namepay.WrongValue.selector);
        namepay.payInvoice{value: 1}(usdcId);

        vm.prank(bob);
        vm.expectRevert(Namepay.TokenNotAllowed.selector);
        namepay.createInvoice(makeAddr("random"), 1, 0, "", false, "", "");
    }

    function testUnknownAndInvalidHandles() public {
        vm.prank(alice);
        vm.expectRevert(Namepay.UnknownHandle.selector);
        namepay.tip("zed", "");

        vm.prank(alice);
        vm.expectRevert(Namepay.InvalidHandle.selector);
        namepay.tip("nope_name", "");

        vm.prank(alice);
        vm.expectRevert(Namepay.InvalidHandle.selector);
        namepay.tip("ab", "");
    }

    function testExistingNameSurvivesTighterBounds() public {
        agent.setBounds(10, 20);
        assertFalse(agent.isValidHandle("bob"));
        vm.prank(alice);
        namepay.tip{value: 1 ether}("bob", "still");
        assertEq(bob.balance, 101 ether);
    }

    function testNoOwnerAndNoWayToSweep() public {
        vm.prank(alice);
        namepay.tip{value: 3 ether}("carol", "ok");
        assertEq(address(namepay).balance, 0);
        assertEq(carol.balance, 103 ether);

        bytes4[5] memory selectors = [
            bytes4(keccak256("owner()")),
            bytes4(keccak256("withdraw()")),
            bytes4(keccak256("pause()")),
            bytes4(keccak256("sweep(address)")),
            bytes4(keccak256("setFee(uint256)"))
        ];
        for (uint256 i; i < selectors.length; ++i) {
            (bool ok,) = address(namepay).call(abi.encodeWithSelector(selectors[i]));
            assertFalse(ok);
        }

        vm.prank(alice);
        (bool sent,) = address(namepay).call{value: 1 ether}("");
        assertFalse(sent);
        assertEq(alice.balance, 97 ether);
        assertEq(address(namepay).balance, 0);
    }

    function testForcedEtherIsStuckRatherThanStealable() public {
        vm.deal(address(this), 1 ether);
        new ForceFeed{value: 1 ether}(payable(address(namepay)));
        assertEq(address(namepay).balance, 1 ether);
        (bool ok,) = address(namepay).call(abi.encodeWithSignature("withdraw()"));
        assertFalse(ok);
        (ok,) = address(namepay).call(abi.encodeWithSignature("withdraw(address)", alice));
        assertFalse(ok);
        assertEq(address(namepay).balance, 1 ether);
        assertEq(alice.balance, 100 ether);
    }

    function testDeployRejectsWrongRegistryOrDecimals() public {
        FakeAgentId fake = new FakeAgentId();
        vm.expectRevert(Namepay.UnexpectedAgentId.selector);
        new Namepay(address(fake), address(usdc));

        MockERC20 six = new MockERC20("USD Coin", "USDC", 6);
        vm.expectRevert(Namepay.UnexpectedUsdc.selector);
        new Namepay(address(agent), address(six));

        vm.expectRevert(Namepay.ZeroAddress.selector);
        new Namepay(address(0), address(usdc));
    }

    function testPaginationIsNewestFirst() public {
        uint256 a = _invoice(bob, address(0), 0, "", false);
        uint256 b = _invoice(bob, address(0), 0, "", false);
        uint256 c = _invoice(bob, address(0), 0, "", false);
        uint256[] memory page = namepay.recipientInvoiceIds(_id("bob"), 0, 2);
        assertEq(page.length, 2);
        assertEq(page[0], c);
        assertEq(page[1], b);
        page = namepay.recipientInvoiceIds(_id("bob"), 2, 2);
        assertEq(page.length, 1);
        assertEq(page[0], a);
        assertEq(namepay.recipientInvoiceCount(_id("bob")), 3);
    }

    function testMemoAndActionLimits() public {
        string memory longMemo = new string(141);
        vm.prank(bob);
        vm.expectRevert(Namepay.MemoTooLong.selector);
        namepay.createInvoice(address(0), 0, 0, "", false, longMemo, "");

        _invoice(bob, address(0), 0, "", true);
        vm.prank(alice);
        namepay.payInvoice(1);
        vm.prank(alice);
        vm.expectRevert(Namepay.EmptyAction.selector);
        namepay.usePass(1, "");
    }

    function testDoublePayReverts() public {
        uint256 id = _invoice(bob, address(0), 0, "", false);
        vm.prank(alice);
        namepay.payInvoice(id);
        vm.prank(carol);
        vm.expectRevert(Namepay.AlreadyPaid.selector);
        namepay.payInvoice(id);
    }

    function testEndToEndIdentityPaymentAndAccess() public {
        vm.prank(bob);
        namepay.setProfile("studio", true, true, address(0), 0, "visit");

        vm.prank(bob);
        uint256 id = namepay.createInvoice(address(0), 1 ether, 0, "", true, "poster", "show");

        vm.prank(alice);
        namepay.payInvoice{value: 1 ether}(id);
        vm.prank(alice);
        namepay.buyPass("bob");
        vm.prank(alice);
        namepay.usePass(1, "show");
        vm.prank(alice);
        namepay.usePass(2, "visit");

        assertEq(bob.balance, 101 ether);
        assertEq(address(namepay).balance, 0);
        assertEq(namepay.passCountOf(_id("alice")), 2);
        assertEq(namepay.payerInvoiceCount(_id("alice")), 1);
        assertEq(namepay.passInfo(1).label, "show");
        assertEq(namepay.passInfo(2).label, "visit");
        (bool holds, string memory handle, uint256 tokenId) = namepay.identityOf(alice);
        assertTrue(holds);
        assertEq(handle, "alice");
        assertEq(tokenId, _id("alice"));
    }

    function _invoice(address who, address token, uint256 amount, string memory restricted, bool mintPass)
        internal
        returns (uint256 id)
    {
        vm.prank(who);
        id = namepay.createInvoice(token, amount, 0, restricted, mintPass, "memo", mintPass ? "gate" : "");
    }

    function _id(string memory handle) internal pure returns (uint256) {
        return uint256(keccak256(bytes(handle)));
    }
}

/// @notice 可选的主网只读检查。默认跳过，设置 NAMEPAY_FORK_TEST=1 后会分叉 BSC。
contract AgentIdForkTest is Test {
    function testLiveZapResolution() public {
        string memory flag = vm.envOr("NAMEPAY_FORK_TEST", string(""));
        if (bytes(flag).length == 0) {
            vm.skip(true);
            return;
        }

        vm.createSelectFork(vm.envOr("BSC_RPC_URL", string("https://bsc-dataseed.bnbchain.org")));
        IAgentId registry = IAgentId(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);
        assertEq(registry.name(), "SPACE ID Agent ID");
        assertEq(registry.symbol(), "AI");

        address zap = registry.ownerOfHandle("zap");
        assertEq(zap, 0x5B95b1fc7C092B75D8A2220c770CC9cFe10f6723);
        assertGt(registry.balanceOf(zap), 0);
        assertEq(registry.handleOf(zap), "zap");
        uint256 tokenId = uint256(keccak256("zap"));
        assertEq(registry.ownerOf(tokenId), zap);
        assertEq(tokenId, 45405531122614838598323868634873948336293447013232527503245539178850475168079);
        assertTrue(registry.isValidHandle("zap"));
        assertFalse(registry.isValidHandle("Zap"));
        assertEq(registry.ownerOfHandle("zap.ai"), address(0));
    }
}
