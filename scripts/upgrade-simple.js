const { ethers, upgrades } = require("hardhat");

/**
 * 简化版代理合约升级脚本（跳过一些安全检查用于演示）
 */
async function main() {
    console.log("🔄 简化版代理合约升级脚本\n");

    const [upgrader] = await ethers.getSigners();
    console.log("👤 升级者:", upgrader.address);

    // 从配置文件读取代理地址
    let PROXY_ADDRESS;
    try {
        const fs = require('fs');
        const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
        PROXY_ADDRESS = deployments.localhost?.proxy;
    } catch (error) {
        console.error("❌ 无法读取部署配置文件");
        process.exit(1);
    }

    if (!PROXY_ADDRESS) {
        console.error("❌ 未找到代理合约地址");
        process.exit(1);
    }

    console.log("🎯 代理地址:", PROXY_ADDRESS);

    try {
        console.log("\n🔍 验证当前状态...");
        const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log("  - 当前实现:", currentImpl);

        // 连接到现有代理
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        const proxy = NFTAuctionPlatform.attach(PROXY_ADDRESS);
        const owner = await proxy.owner();
        console.log("  - 合约所有者:", owner);

        if (owner.toLowerCase() !== upgrader.address.toLowerCase()) {
            console.error("❌ 权限不足");
            process.exit(1);
        }

        console.log("\n📦 准备V2实现...");
        const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");

        console.log("🔄 执行升级（跳过严格验证）...");
        
        // 使用 unsafeUpgrade 跳过安全检查（仅用于演示）
        const upgradedProxy = await upgrades.upgradeProxy(
            PROXY_ADDRESS, 
            NFTAuctionPlatformV2,
            {
                unsafeAllow: ['missing-public-upgradeto', 'delegatecall', 'constructor'],
                unsafeSkipStorageCheck: false // 仍然检查存储布局
            }
        );

        console.log("✅ 升级完成！");

        const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
        console.log("  - 新实现地址:", newImpl);
        console.log("  - 代理地址不变:", upgradedProxy.address === PROXY_ADDRESS ? "✅" : "❌");

        // 验证数据完整性
        const ownerAfterUpgrade = await upgradedProxy.owner();
        console.log("  - 所有者保持:", ownerAfterUpgrade === owner ? "✅" : "❌");

        console.log("\n🆕 测试V2功能...");
        const proxyAsV2 = NFTAuctionPlatformV2.attach(PROXY_ADDRESS);
        
        try {
            await proxyAsV2.initializeV2();
            console.log("✅ V2初始化完成");
        } catch (error) {
            console.log("ℹ️ V2初始化:", error.message);
        }

        console.log("\n🎉 升级成功！");
        console.log("📋 升级摘要:");
        console.log("  - 代理地址:", PROXY_ADDRESS);
        console.log("  - 旧实现:", currentImpl);
        console.log("  - 新实现:", newImpl);

    } catch (error) {
        console.error("❌ 升级失败:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });