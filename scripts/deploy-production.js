const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

/**
 * 生产级部署脚本 - 演示 deployments.json 的完整生命周期
 * 这个脚本展示了配置文件是如何在部署过程中创建和维护的
 */
async function main() {
    console.log("🚀 生产级代理合约部署脚本");
    console.log("📝 演示 deployments.json 生成过程\n");

    // 1. 获取网络和部署者信息
    const network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();
    const networkName = network.chainId === 31337 ? 'localhost' : 
                       network.chainId === 5 ? 'goerli' :
                       network.chainId === 11155111 ? 'sepolia' :
                       network.chainId === 1 ? 'mainnet' : 'unknown';

    console.log("🌐 网络信息:");
    console.log(`   - 网络名: ${networkName}`);
    console.log(`   - ChainId: ${network.chainId}`);
    console.log(`   - 部署者: ${deployer.address}`);
    console.log(`   - 余额: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    // 2. 安全检查
    if (networkName === 'mainnet') {
        console.log("⚠️  主网部署警告!");
        console.log("   - 请确保已经在测试网充分测试");
        console.log("   - 请确认gas价格设置合理");
        console.log("   - 建议使用多重签名钱包");
        
        // 在真实场景中，这里可以添加确认机制
        // const readline = require('readline');
        // // ... 确认逻辑
    }

    // 3. 初始化或加载 deployments.json
    const configPath = 'deployments.json';
    let deployments = {};

    console.log("📂 处理部署配置文件...");
    if (fs.existsSync(configPath)) {
        try {
            deployments = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log("✅ 已加载现有配置文件");
        } catch (error) {
            console.log("⚠️ 配置文件格式错误，创建新配置");
            deployments = {};
        }
    } else {
        console.log("📝 创建新的配置文件");
        deployments = {};
    }

    // 4. 确保网络配置存在
    if (!deployments[networkName]) {
        deployments[networkName] = {
            chainId: network.chainId,
            proxy: "",
            implementation: "",
            deployer: "",
            deployedAt: "",
            implementationV2: "",
            upgradeTransaction: "",
            upgradedAt: "",
            testNFT: "",
            factory: ""
        };
        console.log(`✅ 已初始化 ${networkName} 网络配置`);
    }

    // 5. 检查是否已经部署过
    if (deployments[networkName].proxy && deployments[networkName].proxy !== "") {
        console.log("⚠️ 检测到已存在的部署:");
        console.log(`   - 代理地址: ${deployments[networkName].proxy}`);
        console.log(`   - 实现地址: ${deployments[networkName].implementation}`);
        console.log(`   - 部署时间: ${deployments[networkName].deployedAt}`);
        
        // 在实际场景中可能需要确认是否继续
        console.log("ℹ️ 继续执行新的部署...\n");
    }

    try {
        console.log("=" .repeat(50));
        console.log("开始合约部署流程");
        console.log("=" .repeat(50));

        // 6. 部署测试NFT合约（如果需要）
        let testNFTAddress = deployments[networkName].testNFT;
        if (!testNFTAddress || testNFTAddress === "") {
            console.log("📦 部署测试NFT合约...");
            const TestERC721 = await ethers.getContractFactory("TestERC721");
            const testNFT = await TestERC721.deploy();
            await testNFT.deployed();
            testNFTAddress = testNFT.address;
            console.log("✅ 测试NFT地址:", testNFTAddress);
            
            // 立即保存到配置文件
            deployments[networkName].testNFT = testNFTAddress;
            fs.writeFileSync(configPath, JSON.stringify(deployments, null, 2));
        } else {
            console.log("♻️ 使用现有测试NFT地址:", testNFTAddress);
        }

        // 7. 部署主要的代理合约
        console.log("\n📦 部署NFT拍卖平台代理合约...");
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        
        const proxy = await upgrades.deployProxy(
            NFTAuctionPlatform,
            [], // 初始化参数
            {
                initializer: 'initialize',
                kind: 'uups'
            }
        );
        await proxy.deployed();

        console.log("✅ 代理合约地址:", proxy.address);
        
        // 获取实现合约地址
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxy.address);
        console.log("✅ 实现合约地址:", implementationAddress);

        // 8. 更新配置文件 - 主要部署信息
        console.log("\n💾 保存部署信息到配置文件...");
        deployments[networkName].proxy = proxy.address;
        deployments[networkName].implementation = implementationAddress;
        deployments[networkName].deployer = deployer.address;
        deployments[networkName].deployedAt = new Date().toISOString();

        // 更新元信息
        if (!deployments.metadata) {
            deployments.metadata = {};
        }
        deployments.metadata.lastDeployment = {
            network: networkName,
            timestamp: new Date().toISOString(),
            deployer: deployer.address
        };

        fs.writeFileSync(configPath, JSON.stringify(deployments, null, 2));
        console.log("✅ 部署信息已保存");

        // 9. 部署工厂合约（可选）
        console.log("\n📦 部署NFT拍卖工厂合约...");
        const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
        const factory = await NFTAuctionFactory.deploy();
        await factory.deployed();
        console.log("✅ 工厂合约地址:", factory.address);

        // 更新工厂地址
        deployments[networkName].factory = factory.address;
        fs.writeFileSync(configPath, JSON.stringify(deployments, null, 2));

        // 10. 验证部署
        console.log("\n🔍 验证部署结果...");
        const proxyOwner = await proxy.owner();
        console.log("   - 代理合约owner:", proxyOwner);
        console.log("   - Owner正确:", proxyOwner === deployer.address ? "✅" : "❌");
        
        // 验证升级功能
        console.log("   - 验证升级权限...");
        try {
            // 这里只是检查函数存在，不实际调用
            const upgradeInterface = proxy.interface.getFunction('upgradeToAndCall');
            console.log("   - 升级函数:", upgradeInterface ? "✅" : "❌");
        } catch (error) {
            console.log("   - 升级函数: ❌");
        }

        // 11. 生成部署报告
        console.log("\n" + "=" .repeat(50));
        console.log("📊 部署完成报告");
        console.log("=" .repeat(50));
        
        console.log(`\n🌐 网络: ${networkName} (ChainId: ${network.chainId})`);
        console.log(`👤 部署者: ${deployer.address}`);
        console.log(`⏰ 部署时间: ${deployments[networkName].deployedAt}`);
        
        console.log(`\n📋 合约地址:`);
        console.log(`   🔹 NFT拍卖代理: ${deployments[networkName].proxy}`);
        console.log(`   🔹 实现合约: ${deployments[networkName].implementation}`);
        console.log(`   🔹 测试NFT: ${deployments[networkName].testNFT}`);
        console.log(`   🔹 工厂合约: ${deployments[networkName].factory}`);

        console.log(`\n⚙️ 配置文件:`);
        console.log(`   📁 路径: ${configPath}`);
        console.log(`   📊 大小: ${fs.statSync(configPath).size} bytes`);

        // 12. 生成使用示例
        console.log(`\n💡 使用示例:`);
        console.log(`
    // JavaScript/Hardhat 中使用:
    const deployments = require('./deployments.json');
    const proxyAddress = deployments.${networkName}.proxy;
    const proxy = await ethers.getContractAt("NFTAuctionPlatform", proxyAddress);
    
    // 前端应用中使用:
    const config = await fetch('./deployments.json').then(r => r.json());
    const contractAddress = config.${networkName}.proxy;
        `);

        console.log("\n🎉 部署脚本执行完成！");

    } catch (error) {
        console.error("❌ 部署过程中发生错误:", error.message);
        
        // 即使部署失败，也要保存错误信息到配置文件
        if (!deployments.errors) {
            deployments.errors = [];
        }
        deployments.errors.push({
            network: networkName,
            timestamp: new Date().toISOString(),
            error: error.message,
            deployer: deployer.address
        });
        
        fs.writeFileSync(configPath, JSON.stringify(deployments, null, 2));
        throw error;
    }
}

// 工具函数：读取配置文件中的地址
function getDeployedAddress(network, contractType) {
    try {
        const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
        return deployments[network]?.[contractType] || "";
    } catch (error) {
        return "";
    }
}

// 工具函数：更新配置文件
function updateConfig(network, updates) {
    try {
        const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
        if (!deployments[network]) {
            deployments[network] = {};
        }
        
        Object.assign(deployments[network], updates);
        
        // 更新最后修改时间
        if (!deployments.metadata) {
            deployments.metadata = {};
        }
        deployments.metadata.lastUpdated = new Date().toISOString();
        
        fs.writeFileSync('deployments.json', JSON.stringify(deployments, null, 2));
        return true;
    } catch (error) {
        console.error("配置文件更新失败:", error.message);
        return false;
    }
}

// 导出工具函数供其他脚本使用
module.exports = {
    getDeployedAddress,
    updateConfig
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 部署脚本执行失败:", error);
        process.exit(1);
    });