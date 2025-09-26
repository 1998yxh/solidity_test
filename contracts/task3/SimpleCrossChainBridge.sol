// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleCrossChainBridge
 * @dev 简化的跨链桥，专注于转账功能
 */
contract SimpleCrossChainBridge is Ownable, ReentrancyGuard {
    
    // 跨链转账数据结构
    struct CrossChainTransfer {
        address sender;
        address recipient;
        address token;      // address(0) 表示 ETH
        uint256 amount;
        uint64 destinationChain;
        string message;
        uint256 timestamp;
        bool completed;
    }

    // 存储跨链转账
    mapping(bytes32 => CrossChainTransfer) public transfers;
    
    // 支持的链
    mapping(uint64 => bool) public supportedChains;
    
    // 远程桥接合约
    mapping(uint64 => address) public remoteBridges;
    
    // 转账费用 (以 ETH 计算)
    uint256 public transferFee = 0.001 ether;
    
    // 转账计数器
    uint256 public transferCounter;

    // 事件
    event CrossChainTransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        uint64 destinationChain,
        string message
    );

    event CrossChainTransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event ChainSupported(uint64 indexed chainId, bool supported);
    event RemoteBridgeSet(uint64 indexed chainId, address bridge);
    event FeeUpdated(uint256 newFee);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev 设置支持的链
     */
    function setSupportedChain(uint64 chainId, bool supported) external onlyOwner {
        supportedChains[chainId] = supported;
        emit ChainSupported(chainId, supported);
    }

    /**
     * @dev 设置远程桥接合约
     */
    function setRemoteBridge(uint64 chainId, address bridgeAddress) external onlyOwner {
        remoteBridges[chainId] = bridgeAddress;
        emit RemoteBridgeSet(chainId, bridgeAddress);
    }

    /**
     * @dev 设置转账费用
     */
    function setTransferFee(uint256 newFee) external onlyOwner {
        transferFee = newFee;
        emit FeeUpdated(newFee);
    }

    /**
     * @dev 跨链转账 ETH
     */
    function transferETHCrossChain(
        uint64 destinationChain,
        address recipient,
        string calldata message
    ) external payable nonReentrant {
        require(supportedChains[destinationChain], "Chain not supported");
        require(recipient != address(0), "Invalid recipient");
        require(msg.value > transferFee, "Insufficient amount");

        uint256 transferAmount = msg.value - transferFee;
        bytes32 transferId = _generateTransferId();

        transfers[transferId] = CrossChainTransfer({
            sender: msg.sender,
            recipient: recipient,
            token: address(0),
            amount: transferAmount,
            destinationChain: destinationChain,
            message: message,
            timestamp: block.timestamp,
            completed: false
        });

        emit CrossChainTransferInitiated(
            transferId,
            msg.sender,
            recipient,
            address(0),
            transferAmount,
            destinationChain,
            message
        );
    }

    /**
     * @dev 跨链转账 ERC20 代币
     */
    function transferTokenCrossChain(
        uint64 destinationChain,
        address recipient,
        address token,
        uint256 amount,
        string calldata message
    ) external payable nonReentrant {
        require(supportedChains[destinationChain], "Chain not supported");
        require(recipient != address(0), "Invalid recipient");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(msg.value >= transferFee, "Insufficient fee");

        // 转移代币到桥合约
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        bytes32 transferId = _generateTransferId();

        transfers[transferId] = CrossChainTransfer({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            destinationChain: destinationChain,
            message: message,
            timestamp: block.timestamp,
            completed: false
        });

        emit CrossChainTransferInitiated(
            transferId,
            msg.sender,
            recipient,
            token,
            amount,
            destinationChain,
            message
        );
    }

    /**
     * @dev 完成跨链转账 (模拟从其他链接收)
     */
    function completeTransfer(
        bytes32 transferId,
        address recipient,
        address token,
        uint256 amount
    ) external onlyOwner {
        require(!transfers[transferId].completed, "Transfer already completed");

        if (token == address(0)) {
            // 转账 ETH
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // 转账 ERC20 代币
            IERC20(token).transfer(recipient, amount);
        }

        transfers[transferId].completed = true;

        emit CrossChainTransferCompleted(transferId, recipient, token, amount);
    }

    /**
     * @dev 模拟处理来自其他链的转账
     */
    function simulateReceiveTransfer(
        address sender,
        address recipient,
        address token,
        uint256 amount,
        string calldata message
    ) external onlyOwner {
        bytes32 transferId = _generateTransferId();

        transfers[transferId] = CrossChainTransfer({
            sender: sender,
            recipient: recipient,
            token: token,
            amount: amount,
            destinationChain: uint64(block.chainid),
            message: message,
            timestamp: block.timestamp,
            completed: true
        });

        if (token == address(0)) {
            // 转账 ETH
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // 转账 ERC20 代币
            IERC20(token).transfer(recipient, amount);
        }

        emit CrossChainTransferCompleted(transferId, recipient, token, amount);
    }

    /**
     * @dev 生成转账ID
     */
    function _generateTransferId() internal returns (bytes32) {
        transferCounter++;
        return keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            transferCounter
        ));
    }

    /**
     * @dev 获取转账信息
     */
    function getTransfer(bytes32 transferId) external view returns (CrossChainTransfer memory) {
        return transfers[transferId];
    }

    /**
     * @dev 提取费用
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev 紧急提取代币
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }

    // 接收 ETH
    receive() external payable {}
}