# NFT 拍卖平台 - 快速开始指南

## 🎯 项目简介

这是一个基于以太坊的去中心化NFT拍卖平台，具备以下核心功能：
- 🏆 多种拍卖模式（英式、荷兰式、密封竞价）
- 🔄 可升级智能合约（UUPS代理模式）
- 🌉 跨链资产桥接
- 🏭 工厂模式批量管理
- 💰 多代币支付支持

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0
- npm or yarn
- MetaMask钱包

### 安装和启动
```bash
# 1. 安装依赖
npm install

# 2. 启动本地区块链
npx hardhat node

# 3. 部署合约（新终端）
npx hardhat run scripts/deploy-production.js --network localhost
```

## 📊 主要合约

| 合约 | 功能 | 地址 |
|-----|------|------|
| NFTAuctionPlatform | 核心拍卖逻辑 | 代理合约地址 |
| NFTAuctionFactory | 批量管理 | 工厂合约地址 |
| SimpleCrossChainBridge | 跨链桥接 | 桥接合约地址 |

## 🎮 演示脚本

```bash
# NFT拍卖完整流程
npx hardhat run scripts/nft-flow-demo.js --network localhost

# 跨链转账演示
npx hardhat run scripts/cross-chain-demo.js --network localhost

# 代理合约升级演示
npx hardhat run scripts/upgrade-direct.js --network localhost
```

## 🔧 核心功能使用

### 1. 创建NFT拍卖
```javascript
// 1. 铸造NFT
await nft.mint(seller.address, tokenId);

// 2. 授权给拍卖平台
await nft.approve(auctionPlatform.address, tokenId);

// 3. 创建拍卖
await auctionPlatform.createAuction(
    nft.address,
    tokenId, 
    ethers.utils.parseEther("0.1"), // 起拍价
    3600 // 1小时
);
```

### 2. 参与拍卖
```javascript
// ETH出价
await auctionPlatform.bidWithETH(auctionId, {
    value: ethers.utils.parseEther("0.15")
});

// 代币出价
await token.approve(auctionPlatform.address, amount);
await auctionPlatform.bidWithToken(auctionId, token.address, amount);
```

### 3. 升级合约
```javascript
// 部署新实现
const V2 = await ethers.getContractFactory("NFTAuctionPlatformV2");
const v2Impl = await V2.deploy();

// 执行升级
await proxy.upgradeToAndCall(v2Impl.address, "0x");
```

## 📁 项目结构

```
├── contracts/task3/              # 核心合约
│   ├── NFTAuctionPlatform.sol   # V1拍卖平台
│   ├── NFTAuctionPlatformV2.sol # V2增强版本
│   ├── NFTAuctionFactory.sol    # 工厂合约
│   └── SimpleCrossChainBridge.sol # 跨链桥
├── scripts/                      # 部署和测试脚本
│   ├── deploy-production.js     # 生产部署
│   ├── upgrade-direct.js        # 直接升级
│   ├── nft-flow-demo.js         # NFT流程演示
│   └── cross-chain-demo.js      # 跨链演示
├── test/                        # 测试文件
└── deployments.json             # 部署配置
```

## ⚠️ 重要提醒

### 升级系统问题
- ✅ **推荐**: 使用 `upgrade-direct.js`（直接调用合约函数）
- ❌ **避免**: 使用 `upgrade-proxy.js`（OpenZeppelin检查过严）

### 网络连接问题
```bash
# 如果连接失败，重新启动网络
taskkill /F /IM node.exe
npx hardhat node
```

## 🎉 成功部署示例

```bash
🚀 生产环境代理合约部署

📋 部署信息:
  - 网络: localhost (chainId: 31337)
  - 部署者: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  - 余额: 9999.99 ETH

✅ 代理合约部署成功: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
✅ 实现合约地址: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

🎉 部署完成！
```

## 🔗 相关资源

- 📖 [完整开发文档](PROJECT_SUMMARY.md)
- 🔧 [代理升级指南](README-PROXY.md)
- 🧪 [测试文档](test/README.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

⭐ 如果这个项目对您有帮助，请给个Star！