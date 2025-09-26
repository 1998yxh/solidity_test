# 代理合约部署和升级指南

本指南介绍如何使用项目中的脚本来部署和升级UUPS代理合约。

## 📂 脚本文件说明

### 部署脚本
- `deploy-proxy.js` - 完整演示脚本，展示三种部署方式
- `deploy-production.js` - 生产环境部署脚本，安全且简洁
- `deployments.json` - 部署配置文件，记录各网络的合约地址

### 升级脚本  
- `upgrade-proxy.js` - 标准升级脚本，使用Hardhat插件
- `upgrade-direct.js` - 直接调用合约升级函数
- `upgrade-simple.js` - 简化版升级脚本（跳过部分验证）

### 演示脚本
- `proxy-location-demo.js` - 展示代理模式在代码中的位置
- `nft-flow-demo.js` - NFT拍卖流程演示
- `cross-chain-demo.js` - 跨链功能演示

## 🚀 快速开始

### 1. 启动本地网络
```powershell
npx hardhat node
```

### 2. 部署代理合约
```powershell
# 生产环境部署
npx hardhat run scripts/deploy-production.js --network localhost

# 完整演示（三种部署方式）
npx hardhat run scripts/deploy-proxy.js --network localhost
```

### 3. 升级代理合约
```powershell
# 直接升级（推荐）
npx hardhat run scripts/upgrade-direct.js --network localhost

# 使用Hardhat插件升级
npx hardhat run scripts/upgrade-proxy.js --network localhost
```

## 📋 部署方式对比

| 部署方式 | 脚本文件 | 优点 | 缺点 | 适用场景 |
|---------|---------|------|------|---------|
| Hardhat插件 | deploy-production.js | 自动化、安全验证 | 依赖插件 | 生产环境 |
| 手动部署 | deploy-proxy.js | 完全控制 | 复杂、易错 | 学习理解 |
| 工厂模式 | deploy-proxy.js | 批量管理 | 额外gas成本 | 多实例管理 |

## 🔧 配置文件说明

### deployments.json
```json
{
  "localhost": {
    "chainId": 31337,
    "proxy": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "implementation": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "implementationV2": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "deployedAt": "2025-09-24T11:27:11.838Z",
    "upgradeTransaction": "0x50d28427ba69c87d127f706f9a4c7da3e4e630fa6060408bc96d40a38e2172cc",
    "upgradedAt": "2025-09-24T11:29:49.786Z"
  }
}
```

## 🔄 升级流程详解

### 1. 准备阶段
- 确认有升级权限（合约owner）
- 部署新的实现合约（V2）
- 验证存储布局兼容性

### 2. 执行升级
- 调用代理合约的 `upgradeToAndCall` 函数
- 传入新实现地址和初始化数据
- 等待交易确认

### 3. 验证升级
- 检查实现地址是否更新
- 验证原有数据是否保持
- 测试新功能是否正常工作

## 🛡️ 安全要点

### 权限控制
- 只有合约owner可以执行升级
- `_authorizeUpgrade`函数控制升级权限
- 建议使用多重签名钱包作为owner

### 存储兼容性
- 新版本不能改变已有变量的存储位置
- 只能在存储布局末尾添加新变量
- 使用Hardhat插件自动检查兼容性

### 初始化安全
- 实现合约构造函数中调用`_disableInitializers()`
- 使用`initializer`修饰符防止重复初始化
- V2版本使用`reinitializer(2)`进行重新初始化

## 🌐 网络配置

### 本地网络 (localhost)
```javascript
localhost: {
  url: "http://127.0.0.1:8545"
}
```

### 测试网络
- Goerli: 测试网部署
- Sepolia: 另一个测试网选择
- 主网: 生产环境部署

## 📊 Gas费用估算

| 操作 | 估算Gas | 说明 |
|-----|--------|------|
| 部署实现合约 | ~2,000,000 | 业务逻辑合约 |
| 部署代理合约 | ~400,000 | ERC1967Proxy |
| 升级操作 | ~100,000 | 更新实现地址 |
| 初始化V2 | ~50,000 | 新版本初始化 |

## 🔍 故障排除

### 常见问题

1. **Cannot connect to network**
   - 检查Hardhat网络是否启动
   - 确认端口8545是否可用

2. **Not upgrade safe**
   - 检查V2合约是否正确继承
   - 确认初始化函数是否正确设置

3. **权限不足**
   - 确认当前账户是否为合约owner
   - 检查网络配置是否正确

### 解决方案
- 使用`upgrade-direct.js`跳过严格验证
- 检查`deployments.json`配置文件
- 查看交易日志获取详细错误信息

## 📝 最佳实践

1. **测试优先**: 在测试网充分测试后再部署主网
2. **代码审计**: 重要合约上线前进行专业审计
3. **渐进升级**: 采用小步快跑的升级策略
4. **备份方案**: 准备回滚和应急处理方案
5. **监控告警**: 建立完善的监控和告警机制

## 🚀 下一步

- 集成前端应用
- 添加更多测试用例
- 实现治理机制
- 部署到主网

---

## 📞 支持

如有问题，请检查：
1. Hardhat配置文件
2. 网络连接状态
3. 合约编译结果
4. 部署日志信息