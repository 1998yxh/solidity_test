// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BeggingContract {
    address public owner;  // 合约所有者
    mapping(address => uint256) public donations;  // 记录每个捐赠者的捐赠金额

    // 事件：记录捐赠
    event Donated(address indexed donor, uint256 amount);
    // 事件：记录提款
    event Withdrawn(address indexed recipient, uint256 amount);

    // 构造函数：设置合约所有者为部署者
    constructor() {
        owner = msg.sender;
    }

    // 修饰符：仅所有者可调用
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // 捐赠函数：payable 允许接收 ETH，并记录捐赠金额
    function donate() external payable {
        require(msg.value > 0, "Donation amount must be greater than 0");
        donations[msg.sender] += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    // 提款函数：仅所有者可调用，提取合约中的所有 ETH
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        payable(owner).transfer(amount);
        emit Withdrawn(owner, amount);
    }

    // 查询某个地址的捐赠金额
    function getDonation(address donor) external view returns (uint256) {
        return donations[donor];
    }

    // Fallback 函数：允许直接向合约地址发送 ETH（等同于 donate）
    fallback() external payable {
        this.donate();
    }

    // Receive 函数：处理直接发送 ETH 的情况（无 calldata）
    receive() external payable {
        this.donate();
    }
}