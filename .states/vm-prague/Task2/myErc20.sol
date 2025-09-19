// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;



// --- Ownable 合约（访问控制）---
    abstract contract Ownable {
    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }   
 }

contract myErc20 is Ownable {
    string public name;
    string public symbol;
    uint8 public decimals = 18;  // 标准 ERC20 小数位数
    uint256 public totalSupply;

    // 余额映射：address => balance
    mapping(address => uint256) private _balances;
    // 授权映射：owner => (spender => amount)
    mapping(address => mapping(address => uint256)) private _allowances;

    // 事件：转账和授权
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 initialSupply)
    Ownable(msg.sender)  // <-- 传入 owner 地址（部署者）
     {
        name = _name;
        symbol = _symbol;
        _mint(msg.sender, initialSupply * (10 ** uint256(decimals)));  // 初始化总供应
    }

    // --- ERC20 核心功能 ---
    //查询余额
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    //转账
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    //授权
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    //代扣转账
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    // --- 所有者增发功能 ---
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }


    // --- 内部方法（避免重复代码）---
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        require(_balances[from] >= amount, "ERC20: insufficient balance");

        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero address");
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);  // 从 0x0 地址“铸造”
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        _allowances[owner][spender] = currentAllowance - amount;
    }
}




