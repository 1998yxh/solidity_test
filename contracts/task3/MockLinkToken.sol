// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockLinkToken
 * @dev 模拟 LINK 代币用于测试
 */
contract MockLinkToken is ERC20, Ownable {
    
    constructor() ERC20("Mock ChainLink Token", "LINK") Ownable(msg.sender) {
        // 铸造初始供应量 1000万 LINK
        _mint(msg.sender, 10_000_000 * 10**18);
    }

    /**
     * @dev 铸造代币 (仅所有者)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev 销毁代币
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @dev 批量转账 (用于测试分发)
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev 免费铸造给用户 (仅用于测试)
     */
    function faucet(address to, uint256 amount) external {
        require(amount <= 1000 * 10**18, "Max 1000 LINK per faucet");
        _mint(to, amount);
    }
}