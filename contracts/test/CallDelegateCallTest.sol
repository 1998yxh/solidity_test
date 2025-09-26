// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Call vs DelegateCall 测试合约
 * @dev 用于演示 call 和 delegatecall 的区别
 */

// 目标合约 - 包含业务逻辑
contract CallTestTarget {
    uint256 public value;
    address public sender;
    address public contractAddress;
    
    function updateState(uint256 _value) external {
        value = _value;
        sender = msg.sender;
        contractAddress = address(this);
    }
    
    function reset() external {
        value = 0;
        sender = address(0);
        contractAddress = address(0);
    }
    
    function getCurrentState() external view returns (uint256, address, address) {
        return (value, sender, contractAddress);
    }
}

// 调用者合约 - 演示两种调用方式
contract CallTestCaller {
    uint256 public value;
    address public sender;
    address public contractAddress;
    
    // 使用 call 调用目标合约
    function testCall(address target, uint256 _value) external {
        (bool success, ) = target.call(
            abi.encodeWithSignature("updateState(uint256)", _value)
        );
        require(success, "Call failed");
    }
    
    // 使用 delegatecall 调用目标合约
    function testDelegateCall(address target, uint256 _value) external {
        (bool success, ) = target.delegatecall(
            abi.encodeWithSignature("updateState(uint256)", _value)
        );
        require(success, "DelegateCall failed");
    }
    
    function reset() external {
        value = 0;
        sender = address(0);
        contractAddress = address(0);
    }
    
    function getCurrentState() external view returns (uint256, address, address) {
        return (value, sender, contractAddress);
    }
}

// 简单代理合约 - 演示代理模式
contract SimpleProxyDemo {
    address private immutable implementation;
    
    constructor(address _implementation) {
        implementation = _implementation;
    }
    
    // 所有调用都转发到实现合约
    fallback() external payable {
        address impl = implementation;
        
        assembly {
            // 复制 calldata
            calldatacopy(0, 0, calldatasize())
            
            // delegatecall 到实现合约
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            
            // 复制返回数据
            returndatacopy(0, 0, returndatasize())
            
            // 根据结果返回或回滚
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
    
    receive() external payable {}
}

// 存储冲突演示合约
contract StorageConflictDemo {
    // 演示存储槽冲突问题
    address public owner;        // slot 0
    uint256 public value1;       // slot 1
    uint256 public value2;       // slot 2
    
    mapping(address => uint256) public balances; // slot 3
    
    function setValues(uint256 _value1, uint256 _value2) external {
        value1 = _value1;
        value2 = _value2;
    }
    
    function setBalance(address account, uint256 amount) external {
        balances[account] = amount;
    }
}

// EIP-1967 标准存储槽演示
contract EIP1967Demo {
    // EIP-1967 标准存储槽
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    
    // 常规存储变量
    uint256 public regularValue1;    // slot 0
    uint256 public regularValue2;    // slot 1
    address public regularAddress;   // slot 2
    
    function setImplementation(address newImplementation) external {
        assembly {
            sstore(_IMPLEMENTATION_SLOT, newImplementation)
        }
    }
    
    function getImplementation() external view returns (address) {
        assembly {
            let impl := sload(_IMPLEMENTATION_SLOT)
            mstore(0x00, impl)
            return(0x00, 0x20)
        }
    }
    
    function setAdmin(address newAdmin) external {
        assembly {
            sstore(_ADMIN_SLOT, newAdmin)
        }
    }
    
    function getAdmin() external view returns (address) {
        assembly {
            let admin := sload(_ADMIN_SLOT)
            mstore(0x00, admin)
            return(0x00, 0x20)
        }
    }
}

// 初始化器模式演示
contract InitializerDemo {
    bool private initialized;
    address public owner;
    uint256 public value;
    
    modifier initializer() {
        require(!initialized, "Already initialized");
        _;
        initialized = true;
    }
    
    // ❌ 错误：使用构造函数（在代理模式中不工作）
    // constructor(address _owner, uint256 _value) {
    //     owner = _owner;
    //     value = _value;
    // }
    
    // ✅ 正确：使用初始化函数
    function initialize(address _owner, uint256 _value) external initializer {
        owner = _owner;
        value = _value;
    }
    
    function setValue(uint256 _value) external {
        require(msg.sender == owner, "Only owner");
        value = _value;
    }
}