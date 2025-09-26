const { ethers } = require("hardhat");

/**
 * 直接调用合约升级函数的脚本
 */
async function main() {
    console.log("🔄 直接升级脚本\n");

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

    console.log("🎯 代理地址:", PROXY_ADDRESS);

    try {
        console.log("\n📦 部署V2实现合约...");
        const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");
        const v2Implementation = await NFTAuctionPlatformV2.deploy();
        await v2Implementation.deployed();
        console.log("✅ V2实现地址:", v2Implementation.address);

        console.log("\n🔍 连接到代理合约...");
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        const proxy = NFTAuctionPlatform.attach(PROXY_ADDRESS);

        const owner = await proxy.owner();
        console.log("  - 合约所有者:", owner);
        
        if (owner.toLowerCase() !== upgrader.address.toLowerCase()) {
            console.error("❌ 权限不足");
            process.exit(1);
        }

        console.log("\n🔄 执行升级...");
        const upgradeTx = await proxy.upgradeToAndCall(
            v2Implementation.address,
            "0x" // 空的初始化数据
        );
        await upgradeTx.wait();
        console.log("✅ 升级交易完成:", upgradeTx.hash);

        console.log("\n🔍 验证升级结果...");
        // 通过存储槽读取实现地址
        const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const newImpl = await ethers.provider.getStorageAt(PROXY_ADDRESS, IMPLEMENTATION_SLOT);
        const newImplAddress = ethers.utils.getAddress("0x" + newImpl.slice(-40));
        
        console.log("  - 新实现地址:", newImplAddress);
        console.log("  - 升级成功:", newImplAddress.toLowerCase() === v2Implementation.address.toLowerCase() ? "✅" : "❌");

        // 验证数据完整性
        const ownerAfterUpgrade = await proxy.owner();
        console.log("  - 所有者保持:", ownerAfterUpgrade === owner ? "✅" : "❌");

        console.log("\n🆕 测试V2功能...");
        const proxyAsV2 = NFTAuctionPlatformV2.attach(PROXY_ADDRESS);
        
        try {
            const initTx = await proxyAsV2.initializeV2();
            await initTx.wait();
            console.log("✅ V2初始化完成");
        } catch (error) {
            console.log("ℹ️ V2初始化:", error.message);
        }

        console.log("\n🎉 升级完成！");
        console.log("📋 升级摘要:");
        console.log("  - 代理合约:", PROXY_ADDRESS);
        console.log("  - V2实现合约:", v2Implementation.address);
        console.log("  - 升级交易:", upgradeTx.hash);

        // 更新配置文件
        try {
            const fs = require('fs');
            const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
            deployments.localhost.implementationV2 = v2Implementation.address;
            deployments.localhost.upgradeTransaction = upgradeTx.hash;
            deployments.localhost.upgradedAt = new Date().toISOString();
            fs.writeFileSync('deployments.json', JSON.stringify(deployments, null, 2));
            console.log("✅ 配置文件已更新");
        } catch (error) {
            console.log("⚠️ 配置文件更新失败:", error.message);
        }

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