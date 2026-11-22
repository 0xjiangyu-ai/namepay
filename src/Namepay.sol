// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAgentId, IERC20Minimal} from "./interfaces/IAgentId.sol";

/// @title Namepay
/// @notice 面向 Agent ID 的非托管支付：账单、打赏，以及绑定在付款人 Agent ID 上的访问通行证。
/// @dev
/// 权限清单（部署后没有任何管理员）：
/// - 没有 owner，没有转让所有权
/// - 不能暂停、不能冻结用户、不能改费率
/// - 不能提取用户资金。合约不保管余额，付款在同一笔交易里直接转到收款人
/// - 不能铸造或回收通行证以外的资产。通行证没有转移函数
/// - 构造参数 agentId 与 usdc 是 immutable，部署后不能更换
///
/// Agent ID 在主流程中的位置（不是余额门禁）：
/// - 每个档案、账单、打赏、通行证都按 Agent ID 的 tokenId 记账
/// - tokenId = uint256(keccak256(bytes(handle)))，handle 来自注册表，不含 ".ai"
/// - 付款当场读取 ownerOf(tokenId)，打给这个名字的当前持有人，不使用缓存地址
/// - 账单可以限制“只有某个 Agent ID 能付”，比较的是 tokenId，不是钱包地址
/// - 通行证绑定付款人的 Agent ID。usePass 要求调用者目前持有该 tokenId
///
/// 官方持有判断仍然保留：balanceOf(account) > 0。除此之外还会核对 handleOf 与 ownerOf。
contract Namepay {
    uint256 public constant MAX_BIO = 140;
    uint256 public constant MAX_MEMO = 140;
    uint256 public constant MAX_LABEL = 48;
    uint256 public constant MAX_ACTION = 32;
    uint256 public constant PAGE_LIMIT = 20;
    /// @dev 与 HandleRegistry.LEN_CEILING 一致，避免把超长字符串送进注册表。
    uint256 public constant HANDLE_CEILING = 64;
    string public constant VERSION = "1";

    /// @notice SPACE ID Agent ID 注册表。部署时校验名称与符号。
    IAgentId public immutable agentRegistry;

    /// @notice 唯一允许的 ERC-20。BSC 上为官方 Binance-Peg USDC，18 位小数。
    address public immutable usdc;

    uint256 public invoiceCount;
    uint256 public tipCount;
    uint256 public passCount;

    struct Profile {
        bool active;
        bool tipsOpen;
        bool passOpen;
        address passToken;
        uint256 passPrice;
        string handle;
        string bio;
        string passLabel;
    }

    struct Invoice {
        uint256 recipientAgentId;
        address token;
        uint256 amount;
        uint64 deadline;
        uint256 restrictedPayerAgentId;
        bool mintPass;
        bool paid;
        bool cancelled;
        uint256 payerAgentId;
        address paidTo;
        uint64 paidAt;
        string handle;
        string memo;
        string passLabel;
        string restrictedPayerHandle;
    }

    struct Tip {
        uint256 fromAgentId;
        uint256 toAgentId;
        address token;
        uint256 amount;
        address from;
        address to;
        uint64 timestamp;
        string fromHandle;
        string toHandle;
        string memo;
    }

    struct Pass {
        uint256 holderAgentId;
        uint256 issuerAgentId;
        uint256 invoiceId;
        address token;
        uint256 price;
        uint64 mintedAt;
        uint64 uses;
        uint64 lastUsedAt;
        string holderHandle;
        string issuerHandle;
        string label;
        string lastAction;
    }

    struct InvoiceView {
        uint256 id;
        uint256 recipientAgentId;
        address token;
        uint256 amount;
        uint64 deadline;
        uint256 restrictedPayerAgentId;
        bool mintPass;
        bool paid;
        bool cancelled;
        uint256 payerAgentId;
        address paidTo;
        uint64 paidAt;
        string handle;
        string memo;
        string passLabel;
        string restrictedPayerHandle;
    }

    struct TipView {
        uint256 id;
        uint256 fromAgentId;
        uint256 toAgentId;
        address token;
        uint256 amount;
        address from;
        address to;
        uint64 timestamp;
        string fromHandle;
        string toHandle;
        string memo;
    }

    struct PassView {
        uint256 id;
        uint256 holderAgentId;
        uint256 issuerAgentId;
        uint256 invoiceId;
        address token;
        uint256 price;
        uint64 mintedAt;
        uint64 uses;
        uint64 lastUsedAt;
        string holderHandle;
        string issuerHandle;
        string label;
        string lastAction;
    }

    mapping(uint256 agentTokenId => Profile) private _profiles;
    mapping(uint256 invoiceId => Invoice) private _invoices;
    mapping(uint256 tipId => Tip) private _tips;
    mapping(uint256 passId => Pass) private _passes;

    mapping(uint256 agentTokenId => uint256[]) private _invoicesByRecipient;
    mapping(uint256 agentTokenId => uint256[]) private _invoicesByPayer;
    mapping(uint256 agentTokenId => uint256[]) private _tipsBySender;
    mapping(uint256 agentTokenId => uint256[]) private _tipsByRecipient;
    mapping(uint256 agentTokenId => uint256[]) private _passesByHolder;

    /// @dev 1 = 空闲，2 = 执行中。没有单独的初始化函数，默认 0 会把第一笔交易锁死，所以在构造里设为 1。
    uint256 private _lock;

    error NoAgentId();
    error AgentIdMismatch();
    error InvalidHandle();
    error UnknownHandle();
    error ZeroAddress();
    error UnexpectedAgentId();
    error UnexpectedUsdc();
    error TokenNotAllowed();
    error InvoiceMissing();
    error AlreadyPaid();
    error InvoiceAlreadyCancelled();
    error InvoiceExpired();
    error DeadlineInPast();
    error PayerNotAllowed();
    error SelfPayment();
    error NotRecipient();
    error TipsClosed();
    error PassClosed();
    error PassMissing();
    error NotPassHolder();
    error WrongValue();
    error PaymentFailed();
    error TransferFailed();
    error MemoTooLong();
    error LabelTooLong();
    error BioTooLong();
    error ActionTooLong();
    error EmptyAction();
    error DirectTransfer();
    error Reentrancy();

    event ProfileActivated(uint256 indexed agentTokenId, address indexed holder, string handle);
    event ProfileUpdated(uint256 indexed agentTokenId, address indexed holder);
    event InvoiceCreated(
        uint256 indexed invoiceId,
        uint256 indexed recipientAgentId,
        address indexed creator,
        address token,
        uint256 amount
    );
    event InvoiceCancelled(uint256 indexed invoiceId, address indexed holder);
    event InvoicePaid(
        uint256 indexed invoiceId,
        uint256 indexed recipientAgentId,
        uint256 indexed payerAgentId,
        address payer,
        address recipient,
        address token,
        uint256 amount
    );
    event TipSent(
        uint256 indexed tipId,
        uint256 indexed recipientAgentId,
        uint256 indexed payerAgentId,
        address payer,
        address recipient,
        address token,
        uint256 amount
    );
    event PassMinted(
        uint256 indexed passId,
        uint256 indexed holderAgentId,
        uint256 indexed issuerAgentId,
        address payer,
        uint256 invoiceId,
        address token,
        uint256 price
    );
    event PassUsed(uint256 indexed passId, uint256 indexed holderAgentId, address indexed user, string action);

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @param agentId_ SPACE ID Agent ID 注册表。主网必须是 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F。
    /// @param usdc_ 唯一 ERC-20。主网必须是 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d（18 位小数）。
    constructor(address agentId_, address usdc_) {
        if (agentId_ == address(0) || usdc_ == address(0) || agentId_ == usdc_) revert ZeroAddress();
        if (keccak256(bytes(IAgentId(agentId_).name())) != keccak256(bytes("SPACE ID Agent ID"))) {
            revert UnexpectedAgentId();
        }
        if (keccak256(bytes(IAgentId(agentId_).symbol())) != keccak256(bytes("AI"))) revert UnexpectedAgentId();
        if (IERC20Minimal(usdc_).decimals() != 18) revert UnexpectedUsdc();
        agentRegistry = IAgentId(agentId_);
        usdc = usdc_;
        _lock = 1;
    }

    /// @notice 拒绝把 BNB 直接打进合约。付款只能走 tip / payInvoice / buyPass，并在同一笔交易转出。
    receive() external payable {
        revert DirectTransfer();
    }

    fallback() external payable {
        revert DirectTransfer();
    }

    /// @notice 打开或更新自己的应付档案。第一次调用就是最便宜的链上动作。
    /// @param passToken 仅在 passOpen 时生效。address(0) 表示用 BNB 定价，否则必须是 usdc。
    function setProfile(
        string calldata bio,
        bool tipsOpen,
        bool passOpen,
        address passToken,
        uint256 passPrice,
        string calldata passLabel
    ) external nonReentrant {
        if (bytes(bio).length > MAX_BIO) revert BioTooLong();
        if (bytes(passLabel).length > MAX_LABEL) revert LabelTooLong();
        (string memory handle, uint256 tokenId) = _identity(msg.sender);
        if (passOpen) _checkToken(passToken);

        Profile storage stored = _profiles[tokenId];
        bool wasActive = stored.active;
        stored.active = true;
        stored.tipsOpen = tipsOpen;
        stored.passOpen = passOpen;
        stored.passToken = passOpen ? passToken : address(0);
        stored.passPrice = passOpen ? passPrice : 0;
        stored.handle = handle;
        stored.bio = bio;
        if (!passOpen) {
            stored.passLabel = "";
        } else if (bytes(passLabel).length == 0) {
            stored.passLabel = "access";
        } else {
            stored.passLabel = passLabel;
        }

        if (wasActive) emit ProfileUpdated(tokenId, msg.sender);
        else emit ProfileActivated(tokenId, msg.sender, handle);
    }

    /// @notice 为自己的 Agent ID 开一张账单。金额可以为 0，方便收款人先把链接发出去。
    /// @param token address(0) = BNB，否则只能是 usdc。
    /// @param deadline 0 表示不过期。过期时刻仍可支付，下一秒不可支付。
    /// @param restrictedPayerHandle 空字符串表示任何 Agent ID 持有人可付。可以带或不带 ".ai"。
    /// @param mintPass 支付成功后，给付款人的 Agent ID 铸造一张不可转移的通行证。
    function createInvoice(
        address token,
        uint256 amount,
        uint64 deadline,
        string calldata restrictedPayerHandle,
        bool mintPass,
        string calldata memo,
        string calldata passLabel
    ) external nonReentrant returns (uint256 invoiceId) {
        _checkToken(token);
        if (bytes(memo).length > MAX_MEMO) revert MemoTooLong();
        if (bytes(passLabel).length > MAX_LABEL) revert LabelTooLong();
        if (deadline != 0 && deadline <= block.timestamp) revert DeadlineInPast();

        invoiceId = ++invoiceCount;
        Invoice storage inv = _invoices[invoiceId];
        (inv.handle, inv.recipientAgentId) = _identity(msg.sender);
        (inv.restrictedPayerAgentId, inv.restrictedPayerHandle) =
            _restriction(restrictedPayerHandle, inv.recipientAgentId);
        inv.token = token;
        inv.amount = amount;
        inv.deadline = deadline;
        inv.mintPass = mintPass;
        inv.memo = memo;
        if (mintPass && bytes(passLabel).length == 0) inv.passLabel = "access";
        else inv.passLabel = passLabel;

        _invoicesByRecipient[inv.recipientAgentId].push(invoiceId);
        emit InvoiceCreated(invoiceId, inv.recipientAgentId, msg.sender, token, amount);
    }

    /// @notice 取消尚未支付的账单。只有该 Agent ID 的当前持有人可以取消。
    function cancelInvoice(uint256 invoiceId) external nonReentrant {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.recipientAgentId == 0) revert InvoiceMissing();
        if (inv.paid) revert AlreadyPaid();
        if (inv.cancelled) revert InvoiceAlreadyCancelled();
        (, uint256 callerId) = _identity(msg.sender);
        if (callerId != inv.recipientAgentId) revert NotRecipient();
        inv.cancelled = true;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    /// @notice 支付账单。BNB 必须与金额完全一致；USDC 由调用者在钱包里按精确金额授权后转入当前持有人。
    function payInvoice(uint256 invoiceId) external payable nonReentrant {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.recipientAgentId == 0) revert InvoiceMissing();
        if (inv.paid) revert AlreadyPaid();
        if (inv.cancelled) revert InvoiceAlreadyCancelled();
        if (inv.deadline != 0 && block.timestamp > inv.deadline) revert InvoiceExpired();

        (string memory payerHandle, uint256 payerId) = _identity(msg.sender);
        if (payerId == inv.recipientAgentId) revert SelfPayment();
        if (inv.restrictedPayerAgentId != 0 && inv.restrictedPayerAgentId != payerId) revert PayerNotAllowed();

        address recipient = _currentHolder(inv.recipientAgentId);
        inv.paid = true;
        inv.payerAgentId = payerId;
        inv.paidTo = recipient;
        inv.paidAt = uint64(block.timestamp);
        _invoicesByPayer[payerId].push(invoiceId);

        if (inv.mintPass) {
            _mintPass(
                payerId, payerHandle, inv.recipientAgentId, inv.handle, invoiceId, inv.token, inv.amount, inv.passLabel
            );
        }
        _settle(inv.token, inv.amount, recipient);
        emit InvoicePaid(invoiceId, inv.recipientAgentId, payerId, msg.sender, recipient, inv.token, inv.amount);
    }

    /// @notice 向一个你已经知道的名字打赏 BNB。msg.value 就是金额，可以为 0。
    function tip(string calldata rawHandle, string calldata memo) external payable nonReentrant {
        _tip(rawHandle, address(0), msg.value, memo);
    }

    /// @notice 向一个你已经知道的名字打赏 USDC。金额由参数给出，交易不能附带 BNB。
    function tipToken(string calldata rawHandle, uint256 amount, string calldata memo) external nonReentrant {
        _tip(rawHandle, usdc, amount, memo);
    }

    /// @notice 按对方档案上的标价，购买一张绑定在自己 Agent ID 上的通行证。
    function buyPass(string calldata rawHandle) external payable nonReentrant {
        string memory handle = normalizeHandle(rawHandle);
        (address recipient, uint256 issuerId) = _resolve(handle);
        (string memory payerHandle, uint256 payerId) = _identity(msg.sender);
        if (payerId == issuerId) revert SelfPayment();

        Profile storage offer = _profiles[issuerId];
        if (!offer.active || !offer.passOpen) revert PassClosed();

        address token = offer.passToken;
        uint256 price = offer.passPrice;
        string memory label = offer.passLabel;
        _mintPass(payerId, payerHandle, issuerId, handle, 0, token, price, label);
        _settle(token, price, recipient);
    }

    /// @notice 使用通行证。只有绑定的 Agent ID 的当前持有人可以调用，钱包地址对不上就会失败。
    function usePass(uint256 passId, string calldata action) external nonReentrant {
        uint256 length = bytes(action).length;
        if (length == 0) revert EmptyAction();
        if (length > MAX_ACTION) revert ActionTooLong();

        // 先确认调用者持有 Agent ID，再看通行证。没有身份时不要露出“通行证不存在”这种旁路信息。
        (, uint256 callerId) = _identity(msg.sender);
        Pass storage pass = _passes[passId];
        if (pass.holderAgentId == 0) revert PassMissing();
        if (callerId != pass.holderAgentId) revert NotPassHolder();

        pass.uses += 1;
        pass.lastAction = action;
        pass.lastUsedAt = uint64(block.timestamp);
        emit PassUsed(passId, callerId, msg.sender, action);
    }

    /// @notice 规范化用户输入的名字：去掉首尾空白，去掉一个结尾的 ".ai"，并把 A-Z 变成小写。
    /// @dev 不改写全角字符。注册表本身也不做 Unicode 规范化，链上只认小写 a-z 与数字。
    function normalizeHandle(string calldata input) public pure returns (string memory) {
        bytes memory raw = bytes(input);
        uint256 start;
        uint256 end = raw.length;
        while (start < end && _isSpace(raw[start])) start++;
        while (end > start && _isSpace(raw[end - 1])) end--;

        if (end >= start + 3 && raw[end - 3] == bytes1(".")) {
            bytes1 b = raw[end - 2];
            bytes1 c = raw[end - 1];
            bool bOk = b == bytes1("a") || b == bytes1("A");
            bool cOk = c == bytes1("i") || c == bytes1("I");
            if (bOk && cOk) {
                end -= 3;
                while (end > start && _isSpace(raw[end - 1])) end--;
            }
        }

        bytes memory out = new bytes(end - start);
        for (uint256 i; i < out.length; ++i) {
            bytes1 char = raw[start + i];
            if (char >= 0x41 && char <= 0x5A) {
                char = bytes1(uint8(char) + 32);
            }
            out[i] = char;
        }
        return string(out);
    }

    /// @notice 读取某个地址的 Agent ID。不 revert，方便前端在未持有时展示说明。
    function identityOf(address account) external view returns (bool holds, string memory handle, uint256 tokenId) {
        if (agentRegistry.balanceOf(account) == 0) return (false, "", 0);
        handle = agentRegistry.handleOf(account);
        if (bytes(handle).length == 0) return (false, "", 0);
        tokenId = uint256(keccak256(bytes(handle)));
        try agentRegistry.ownerOf(tokenId) returns (address holder) {
            if (holder != account) return (false, handle, tokenId);
        } catch {
            return (false, handle, tokenId);
        }
        holds = true;
    }

    function profile(uint256 agentTokenId)
        external
        view
        returns (
            bool active,
            bool tipsOpen,
            bool passOpen,
            address passToken,
            uint256 passPrice,
            string memory handle,
            string memory bio,
            string memory passLabel
        )
    {
        Profile storage item = _profiles[agentTokenId];
        return (
            item.active,
            item.tipsOpen,
            item.passOpen,
            item.passToken,
            item.passPrice,
            item.handle,
            item.bio,
            item.passLabel
        );
    }

    function invoice(uint256 invoiceId) external view returns (InvoiceView memory viewItem) {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.recipientAgentId == 0) revert InvoiceMissing();
        viewItem.id = invoiceId;
        viewItem.recipientAgentId = inv.recipientAgentId;
        viewItem.token = inv.token;
        viewItem.amount = inv.amount;
        viewItem.deadline = inv.deadline;
        viewItem.restrictedPayerAgentId = inv.restrictedPayerAgentId;
        viewItem.mintPass = inv.mintPass;
        viewItem.paid = inv.paid;
        viewItem.cancelled = inv.cancelled;
        viewItem.payerAgentId = inv.payerAgentId;
        viewItem.paidTo = inv.paidTo;
        viewItem.paidAt = inv.paidAt;
        viewItem.handle = inv.handle;
        viewItem.memo = inv.memo;
        viewItem.passLabel = inv.passLabel;
        viewItem.restrictedPayerHandle = inv.restrictedPayerHandle;
    }

    function tipInfo(uint256 id) external view returns (TipView memory viewItem) {
        Tip storage item = _tips[id];
        if (item.toAgentId == 0) revert UnknownHandle();
        viewItem.id = id;
        viewItem.fromAgentId = item.fromAgentId;
        viewItem.toAgentId = item.toAgentId;
        viewItem.token = item.token;
        viewItem.amount = item.amount;
        viewItem.from = item.from;
        viewItem.to = item.to;
        viewItem.timestamp = item.timestamp;
        viewItem.fromHandle = item.fromHandle;
        viewItem.toHandle = item.toHandle;
        viewItem.memo = item.memo;
    }

    function passInfo(uint256 passId) external view returns (PassView memory viewItem) {
        Pass storage item = _passes[passId];
        if (item.holderAgentId == 0) revert PassMissing();
        viewItem.id = passId;
        viewItem.holderAgentId = item.holderAgentId;
        viewItem.issuerAgentId = item.issuerAgentId;
        viewItem.invoiceId = item.invoiceId;
        viewItem.token = item.token;
        viewItem.price = item.price;
        viewItem.mintedAt = item.mintedAt;
        viewItem.uses = item.uses;
        viewItem.lastUsedAt = item.lastUsedAt;
        viewItem.holderHandle = item.holderHandle;
        viewItem.issuerHandle = item.issuerHandle;
        viewItem.label = item.label;
        viewItem.lastAction = item.lastAction;
    }

    function recipientInvoiceCount(uint256 agentTokenId) external view returns (uint256) {
        return _invoicesByRecipient[agentTokenId].length;
    }

    function payerInvoiceCount(uint256 agentTokenId) external view returns (uint256) {
        return _invoicesByPayer[agentTokenId].length;
    }

    function sentTipCount(uint256 agentTokenId) external view returns (uint256) {
        return _tipsBySender[agentTokenId].length;
    }

    function receivedTipCount(uint256 agentTokenId) external view returns (uint256) {
        return _tipsByRecipient[agentTokenId].length;
    }

    function passCountOf(uint256 agentTokenId) external view returns (uint256) {
        return _passesByHolder[agentTokenId].length;
    }

    /// @notice 从新到旧返回 id。limit 超过 PAGE_LIMIT 时会被截断。
    function recipientInvoiceIds(uint256 agentTokenId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _page(_invoicesByRecipient[agentTokenId], offset, limit);
    }

    function payerInvoiceIds(uint256 agentTokenId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _page(_invoicesByPayer[agentTokenId], offset, limit);
    }

    function sentTipIds(uint256 agentTokenId, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _page(_tipsBySender[agentTokenId], offset, limit);
    }

    function receivedTipIds(uint256 agentTokenId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _page(_tipsByRecipient[agentTokenId], offset, limit);
    }

    function passIdsOf(uint256 agentTokenId, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _page(_passesByHolder[agentTokenId], offset, limit);
    }

    function _tip(string calldata rawHandle, address token, uint256 amount, string calldata memo) internal {
        if (bytes(memo).length > MAX_MEMO) revert MemoTooLong();
        uint256 id = ++tipCount;
        Tip storage item = _tips[id];
        item.toHandle = normalizeHandle(rawHandle);
        (item.to, item.toAgentId) = _resolve(item.toHandle);
        (item.fromHandle, item.fromAgentId) = _identity(msg.sender);
        if (item.fromAgentId == item.toAgentId) revert SelfPayment();

        Profile storage offer = _profiles[item.toAgentId];
        // 没开过档案的名字仍可收款：对方把名字给你，就是这次支付的范围。
        // 开过档案且明确关掉打赏时，拒绝 tip，账单不受影响。
        if (offer.active && !offer.tipsOpen) revert TipsClosed();

        item.token = token;
        item.amount = amount;
        item.from = msg.sender;
        item.timestamp = uint64(block.timestamp);
        item.memo = memo;
        _tipsBySender[item.fromAgentId].push(id);
        _tipsByRecipient[item.toAgentId].push(id);

        _settle(item.token, item.amount, item.to);
        _emitTip(id);
    }

    function _emitTip(uint256 id) internal {
        Tip storage item = _tips[id];
        emit TipSent(id, item.toAgentId, item.fromAgentId, item.from, item.to, item.token, item.amount);
    }

    function _restriction(string calldata rawHandle, uint256 recipientId)
        internal
        view
        returns (uint256 restrictedId, string memory restrictedHandle)
    {
        if (bytes(rawHandle).length == 0) return (0, "");
        restrictedHandle = normalizeHandle(rawHandle);
        (, restrictedId) = _resolve(restrictedHandle);
        if (restrictedId == recipientId) revert SelfPayment();
    }

    function _mintPass(
        uint256 holderAgentId,
        string memory holderHandle,
        uint256 issuerAgentId,
        string memory issuerHandle,
        uint256 invoiceId,
        address token,
        uint256 price,
        string memory label
    ) internal {
        uint256 passId = ++passCount;
        Pass storage pass = _passes[passId];
        pass.holderAgentId = holderAgentId;
        pass.issuerAgentId = issuerAgentId;
        pass.invoiceId = invoiceId;
        pass.token = token;
        pass.price = price;
        pass.mintedAt = uint64(block.timestamp);
        pass.holderHandle = holderHandle;
        pass.issuerHandle = issuerHandle;
        pass.label = bytes(label).length == 0 ? "access" : label;
        _passesByHolder[holderAgentId].push(passId);
        emit PassMinted(passId, holderAgentId, issuerAgentId, msg.sender, invoiceId, token, price);
    }

    /// @dev 先改状态，再转账。失败则整笔回滚，账单不会停在“已付但没到账”。
    function _settle(address token, uint256 amount, address recipient) internal {
        if (recipient == address(0)) revert RecipientMissing();
        if (token == address(0)) {
            if (msg.value != amount) revert WrongValue();
            if (amount == 0) return;
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert PaymentFailed();
            return;
        }
        if (msg.value != 0) revert WrongValue();
        if (amount == 0) return;
        _transferFrom(token, msg.sender, recipient, amount);
    }

    error RecipientMissing();

    function _transferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _currentHolder(uint256 agentTokenId) internal view returns (address holder) {
        holder = agentRegistry.ownerOf(agentTokenId);
        if (holder == address(0) || agentRegistry.balanceOf(holder) == 0) revert RecipientMissing();
    }

    function _identity(address account) internal view returns (string memory handle, uint256 tokenId) {
        // 官方规则：balanceOf > 0 才是 Agent ID 持有人。
        if (agentRegistry.balanceOf(account) == 0) revert NoAgentId();
        handle = agentRegistry.handleOf(account);
        if (bytes(handle).length == 0) revert NoAgentId();
        tokenId = uint256(keccak256(bytes(handle)));
        if (agentRegistry.ownerOf(tokenId) != account) revert AgentIdMismatch();
    }

    function _resolve(string memory handle) internal view returns (address holder, uint256 tokenId) {
        uint256 length = bytes(handle).length;
        if (length == 0 || length > HANDLE_CEILING) revert InvalidHandle();

        // 已注册的名字以 ownerOfHandle 为准。长度界限日后若被注册表收紧，旧名字仍然可以收款。
        bool valid = agentRegistry.isValidHandle(handle);
        holder = agentRegistry.ownerOfHandle(handle);
        if (holder == address(0)) {
            if (!valid) revert InvalidHandle();
            revert UnknownHandle();
        }

        tokenId = uint256(keccak256(bytes(handle)));
        if (agentRegistry.ownerOf(tokenId) != holder) revert AgentIdMismatch();
        if (agentRegistry.balanceOf(holder) == 0) revert NoAgentId();
    }

    function _checkToken(address token) internal view {
        if (token != address(0) && token != usdc) revert TokenNotAllowed();
    }

    function _page(uint256[] storage ids, uint256 offset, uint256 limit) internal view returns (uint256[] memory out) {
        uint256 n = ids.length;
        if (limit > PAGE_LIMIT) limit = PAGE_LIMIT;
        if (offset >= n || limit == 0) return new uint256[](0);
        uint256 remaining = n - offset;
        if (limit > remaining) limit = remaining;
        out = new uint256[](limit);
        for (uint256 i; i < limit; ++i) {
            out[i] = ids[n - 1 - offset - i];
        }
    }

    function _isSpace(bytes1 char) private pure returns (bool) {
        return char == 0x20 || char == 0x09 || char == 0x0a || char == 0x0d;
    }
}
