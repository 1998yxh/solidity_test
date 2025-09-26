const { ethers, upgrades } = require("hardhat");

/**
 * 代理合约升级脚本
 * 用于将现有代理合约升级到新版本
 */
async function main() {
    console.log("🔄 代理合约升级脚本\n");

    const [upgrader] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📋 升级信息:");
    console.log("  - 网络:", network.name, `(chainId: ${network.chainId})`);
    console.log("  - 升级者:", upgrader.address);
    console.log("  - 余额:", ethers.utils.formatEther(await upgrader.getBalance()), "ETH");

    // 需要升级的代理合约地址（请根据实际情况修改）
    let PROXY_ADDRESS = process.env.PROXY_ADDRESS;
    
    // 如果没有设置环境变量，尝试从配置文件读取
    if (!PROXY_ADDRESS) {
        try {
            const fs = require('fs');
            const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
            const networkName = network.name === 'unknown' ? 'localhost' : network.name;
            PROXY_ADDRESS = deployments[networkName]?.proxy;
        } catch (error) {
            console.log("ℹ️ 无法读取部署配置文件");
        }
    }

    if (!PROXY_ADDRESS || PROXY_ADDRESS === "0x...") {
        console.error("❌ 请设置要升级的代理合约地址");
        console.log("方法1: 设置环境变量 PROXY_ADDRESS");
        console.log("方法2: 在 deployments.json 文件中配置");
        console.log("方法3: 直接在脚本中修改 PROXY_ADDRESS 变量");
        process.exit(1);
    }

    console.log("  - 代理地址:", PROXY_ADDRESS);

    console.log("\n" + "=".repeat(50));
    console.log("开始升级代理合约");
    console.log("=".repeat(50));

    try {
        // 验证当前代理合约
        console.log("\n🔍 验证当前代理合约...");
        const currentImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log("✅ 当前实现地址:", currentImplementation);

        // 连接到现有代理合约
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        const proxy = NFTAuctionPlatform.attach(PROXY_ADDRESS);
        
        // 验证升级权限
        const owner = await proxy.owner();
        console.log("  - 合约所有者:", owner);
        
        if (owner.toLowerCase() !== upgrader.address.toLowerCase()) {
            console.error("❌ 权限不足：您不是合约所有者");
            console.log("  合约所有者:", owner);
            console.log("  当前账户:", upgrader.address);
            process.exit(1);
        }
        console.log("✅ 升级权限验证通过");

        // 获取要升级到的新版本合约工厂
        console.log("\n📦 准备V2实现合约...");
        const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");

        // 检查存储布局兼容性
        console.log("🔍 检查存储布局兼容性...");
        await upgrades.validateUpgrade(PROXY_ADDRESS, NFTAuctionPlatformV2);
        console.log("✅ 存储布局兼容性检查通过");

        // 执行升级
        console.log("\n🔄 执行升级...");
        const upgradedProxy = await upgrades.upgradeProxy(PROXY_ADDRESS, NFTAuctionPlatformV2);
        console.log("✅ 升级完成！");

        // 验证升级结果
        console.log("\n🔍 验证升级结果...");
        const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log("  - 新实现地址:", newImplementation);
        console.log("  - 代理地址不变:", upgradedProxy.address === PROXY_ADDRESS ? "✅" : "❌");
        
        // 验证数据完整性
        const ownerAfterUpgrade = await upgradedProxy.owner();
        console.log("  - 所有者保持:", ownerAfterUpgrade === owner ? "✅" : "❌");

        // 测试V2功能
        console.log("\n🆕 测试V2新功能...");
        const proxyAsV2 = NFTAuctionPlatformV2.attach(PROXY_ADDRESS);
        
        try {
            // 调用V2的初始化函数（如果有的话）
            const initTx = await proxyAsV2.initializeV2();
            await initTx.wait();
            console.log("✅ V2初始化完成");
        } catch (error) {
            if (error.message.includes("already initialized")) {
                console.log("ℹ️ V2已经初始化过");
            } else {
                console.log("⚠️ V2初始化跳过:", error.message);
            }
        }

        // 记录升级信息
        const upgradeInfo = {
            network: network.name,
            chainId: network.chainId,
            upgrader: upgrader.address,
            proxy: PROXY_ADDRESS,
            oldImplementation: currentImplementation,
            newImplementation: newImplementation,
            blockNumber: await ethers.provider.getBlockNumber(),
            timestamp: new Date().toISOString()
        };

        console.log("\n📋 升级摘要:");
        console.log("  - 代理合约:", upgradeInfo.proxy);
        console.log("  - 旧实现:", upgradeInfo.oldImplementation);
        console.log("  - 新实现:", upgradeInfo.newImplementation);
        console.log("  - 升级区块:", upgradeInfo.blockNumber);

        console.log("\n💾 升级信息已记录:");
        console.log(JSON.stringify(upgradeInfo, null, 2));

        console.log("\n🎉 升级成功完成！");
        console.log("💡 提示：代理合约地址保持不变，用户无需更新前端配置");

    } catch (error) {
        console.error("❌ 升级失败:", error.message);
        
        // 提供故障排除建议
        console.log("\n🔧 故障排除建议:");
        console.log("1. 检查代理合约地址是否正确");
        console.log("2. 确认您是合约所有者");
        console.log("3. 验证网络连接和gas费用");
        console.log("4. 检查V2合约的存储布局兼容性");
        
        throw error;
    }
}

// 如果直接运行此脚本，则执行main函数
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ 升级脚本执行失败:", error);
            process.exit(1);
        });
}

module.exports = { main };