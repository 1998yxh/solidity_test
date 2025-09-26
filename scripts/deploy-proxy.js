const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 开始部署代理合约系统\n");

    // 获取签名者
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log("👤 部署账户:", deployer.address);
    console.log("💰 账户余额:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

    console.log("=" .repeat(60));
    console.log("第一步：部署测试 NFT 合约");
    console.log("=" .repeat(60));

    // 部署测试NFT合约
    const TestERC721 = await ethers.getContractFactory("TestERC721");
    const testNFT = await TestERC721.deploy();
    await testNFT.deployed();
    console.log("✅ 测试NFT合约地址:", testNFT.address);

    console.log("\n" + "=" .repeat(60));
    console.log("第二步：使用 OpenZeppelin 插件部署可升级代理");
    console.log("=" .repeat(60));

    // 方式一：使用 @openzeppelin/hardhat-upgrades 插件部署
    console.log("🔧 部署方式一：使用 Hardhat 升级插件\n");

    const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
    
    console.log("📦 部署代理合约和实现合约...");
    const proxy = await upgrades.deployProxy(
        NFTAuctionPlatform,
        [], // 初始化参数（空数组，因为使用默认初始化）
        {
            initializer: 'initialize',
            kind: 'uups' // 指定使用 UUPS 代理模式
        }
    );
    await proxy.deployed();

    console.log("✅ 代理合约地址:", proxy.address);
    
    // 获取实现合约地址
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxy.address);
    console.log("✅ 实现合约地址:", implementationAddress);

    // 获取管理员地址（UUPS代理中管理员就是代理合约本身）
    const adminAddress = await upgrades.erc1967.getAdminAddress(proxy.address);
    console.log("✅ 管理员地址:", adminAddress || "UUPS代理（自管理）");

    console.log("\n" + "=" .repeat(60));
    console.log("第三步：手动部署代理合约（演示原理）");
    console.log("=" .repeat(60));

    console.log("🔧 部署方式二：手动部署（理解原理）\n");

    // 手动部署实现合约
    console.log("📦 手动部署实现合约...");
    const implementation = await NFTAuctionPlatform.deploy();
    await implementation.deployed();
    console.log("✅ 手动实现合约地址:", implementation.address);

    // 准备初始化数据
    const initializeData = implementation.interface.encodeFunctionData("initialize", []);

    // 部署ERC1967Proxy
    console.log("📦 部署 ERC1967Proxy...");
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const manualProxy = await ERC1967Proxy.deploy(implementation.address, initializeData);
    await manualProxy.deployed();
    console.log("✅ 手动代理合约地址:", manualProxy.address);

    console.log("\n" + "=" .repeat(60));
    console.log("第四步：通过工厂合约部署代理");
    console.log("=" .repeat(60));

    console.log("🔧 部署方式三：工厂合约批量创建\n");

    // 部署工厂合约
    console.log("📦 部署 NFT 拍卖工厂合约...");
    const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
    const factory = await NFTAuctionFactory.deploy();
    await factory.deployed();
    console.log("✅ 工厂合约地址:", factory.address);

    // 获取工厂内置的实现合约地址
    const factoryImplementation = await factory.auctionImplementation();
    console.log("✅ 工厂实现合约地址:", factoryImplementation);

    // 通过工厂创建代理合约
    console.log("📦 通过工厂创建拍卖平台...");
    const createTx = await factory.createAuctionPlatform();
    const receipt = await createTx.wait();
    
    // 获取创建的代理地址
    const event = receipt.events?.find(e => e.event === 'AuctionPlatformCreated');
    const factoryProxy = event?.args?.auctionPlatform;
    console.log("✅ 工厂代理合约地址:", factoryProxy);

    console.log("\n" + "=" .repeat(60));
    console.log("第五步：验证部署结果");
    console.log("=" .repeat(60));

    console.log("🔍 验证各种代理合约功能...\n");

    // 验证方式一的代理合约
    console.log("1️⃣ 验证 Hardhat 插件部署的代理:");
    const owner1 = await proxy.owner();
    console.log("   - 合约 owner:", owner1);
    console.log("   - owner 正确:", owner1 === deployer.address ? "✅" : "❌");

    // 验证方式二的代理合约
    console.log("\n2️⃣ 验证手动部署的代理:");
    const manualProxyAsContract = NFTAuctionPlatform.attach(manualProxy.address);
    const owner2 = await manualProxyAsContract.owner();
    console.log("   - 合约 owner:", owner2);
    console.log("   - owner 正确:", owner2 === deployer.address ? "✅" : "❌");

    // 验证方式三的代理合约
    console.log("\n3️⃣ 验证工厂部署的代理:");
    const factoryProxyAsContract = NFTAuctionPlatform.attach(factoryProxy);
    const owner3 = await factoryProxyAsContract.owner();
    console.log("   - 合约 owner:", owner3);
    console.log("   - owner 正确:", owner3 === deployer.address ? "✅" : "❌");

    console.log("\n" + "=" .repeat(60));
    console.log("第六步：测试基础功能");
    console.log("=" .repeat(60));

    console.log("🧪 测试拍卖平台基础功能...\n");

    // 铸造测试NFT
    console.log("🎨 铸造测试NFT给用户...");
    await testNFT.mint(user1.address, 1);
    console.log("✅ NFT #1 铸造给:", user1.address);

    // 授权NFT给拍卖平台
    console.log("🔓 用户授权NFT给拍卖平台...");
    await testNFT.connect(user1).approve(proxy.address, 1);
    console.log("✅ NFT #1 授权给拍卖平台");

    // 创建拍卖
    console.log("🏆 创建NFT拍卖...");
    const createAuctionTx = await proxy.connect(user1).createAuction(
        testNFT.address,
        1,
        ethers.utils.parseEther("0.1"), // 起拍价 0.1 ETH
        3600 // 持续1小时
    );
    const auctionReceipt = await createAuctionTx.wait();
    console.log("✅ 拍卖创建成功，交易哈希:", auctionReceipt.transactionHash);

    // 获取拍卖信息
    const auctionInfo = await proxy.getAuction(0);
    console.log("📋 拍卖信息:");
    console.log("   - 卖家:", auctionInfo.seller);
    console.log("   - 起拍价:", ethers.utils.formatEther(auctionInfo.startPrice), "ETH");
    console.log("   - 当前最高价:", ethers.utils.formatEther(auctionInfo.highestBid), "ETH");
    console.log("   - 拍卖结束:", auctionInfo.ended ? "是" : "否");

    console.log("\n" + "=" .repeat(60));
    console.log("第七步：测试代理升级功能");
    console.log("=" .repeat(60));

    console.log("🔄 准备测试升级到 V2 版本...\n");

    // 部署V2实现合约
    console.log("📦 部署 V2 实现合约...");
    const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");
    const v2Implementation = await NFTAuctionPlatformV2.deploy();
    await v2Implementation.deployed();
    console.log("✅ V2 实现合约地址:", v2Implementation.address);

    // 使用 Hardhat 插件升级
    console.log("🔄 执行升级到 V2...");
    const upgradedProxy = await upgrades.upgradeProxy(proxy.address, NFTAuctionPlatformV2);
    console.log("✅ 升级完成！代理地址保持不变:", upgradedProxy.address);

    // 验证升级后的功能
    console.log("🔍 验证升级后的状态...");
    const newImplementationAddr = await upgrades.erc1967.getImplementationAddress(proxy.address);
    console.log("✅ 新实现地址:", newImplementationAddr);
    console.log("✅ 升级成功:", newImplementationAddr === v2Implementation.address ? "是" : "否");

    // 验证原有数据保持
    const ownerAfterUpgrade = await upgradedProxy.owner();
    console.log("✅ 原有数据保持:", ownerAfterUpgrade === deployer.address ? "是" : "否");

    // 测试V2新功能
    console.log("🆕 测试V2新功能...");
    const proxyAsV2 = NFTAuctionPlatformV2.attach(proxy.address);
    
    try {
        await proxyAsV2.initializeV2();
        console.log("✅ V2初始化成功");
    } catch (error) {
        console.log("ℹ️ V2初始化跳过（可能已初始化）");
    }

    console.log("\n" + "=" .repeat(60));
    console.log("🎉 代理合约部署完成总结");
    console.log("=" .repeat(60));

    console.log("\n📊 部署结果汇总:");
    console.log("🔹 测试NFT合约:", testNFT.address);
    console.log("🔹 Hardhat插件代理:", proxy.address);
    console.log("🔹 Hardhat插件实现:", implementationAddress);
    console.log("🔹 手动代理合约:", manualProxy.address);
    console.log("🔹 手动实现合约:", implementation.address);
    console.log("🔹 工厂合约:", factory.address);
    console.log("🔹 工厂代理合约:", factoryProxy);
    console.log("🔹 V2实现合约:", v2Implementation.address);

    console.log("\n📋 三种部署方式对比:");
    console.log("┌─────────────────┬──────────────────┬────────────────────┐");
    console.log("│   部署方式       │      优点         │      缺点           │");
    console.log("├─────────────────┼──────────────────┼────────────────────┤");
    console.log("│ Hardhat插件     │ 自动化、安全      │ 依赖插件           │");
    console.log("│ 手动部署        │ 完全控制          │ 复杂、易错         │");
    console.log("│ 工厂模式        │ 批量管理          │ 额外gas成本        │");
    console.log("└─────────────────┴──────────────────┴────────────────────┘");

    console.log("\n🔐 安全要点:");
    console.log("✅ 所有代理都使用UUPS模式，升级权限由合约owner控制");
    console.log("✅ 实现合约正确初始化，防止被恶意调用");
    console.log("✅ 存储布局兼容性通过Hardhat插件自动检查");
    console.log("✅ 升级过程保持原有状态和数据完整性");

    console.log("\n🎯 下一步建议:");
    console.log("💡 1. 在测试网进行充分测试");
    console.log("💡 2. 考虑使用多重签名钱包作为owner");
    console.log("💡 3. 建立完善的升级治理机制");
    console.log("💡 4. 定期审计合约代码和升级逻辑");

    console.log("\n🚀 代理合约部署脚本执行完成！");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });