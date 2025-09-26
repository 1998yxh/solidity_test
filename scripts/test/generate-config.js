const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * 生成 deployments.json 配置文件的脚本
 * 这个脚本演示了配置文件是如何创建和维护的
 */
async function main() {
    console.log("📝 生成 deployments.json 配置文件\n");

    // 1. 创建基础配置结构
    console.log("🏗️ 创建基础配置结构...");
    
    const deploymentConfig = {
        // 本地开发网络
        localhost: {
            chainId: 31337,
            rpc: "http://127.0.0.1:8545",
            proxy: "",
            implementation: "",
            deployer: "",
            deployedAt: "",
            // 升级相关
            implementationV2: "",
            upgradeTransaction: "",
            upgradedAt: "",
            // 其他合约地址
            testNFT: "",
            factory: ""
        },
        
        // 测试网络
        goerli: {
            chainId: 5,
            rpc: "https://goerli.infura.io/v3/YOUR_PROJECT_ID",
            proxy: "",
            implementation: "",
            deployer: "",
            deployedAt: "",
            implementationV2: "",
            upgradeTransaction: "",
            upgradedAt: "",
            testNFT: "",
            factory: ""
        },
        
        sepolia: {
            chainId: 11155111,
            rpc: "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
            proxy: "",
            implementation: "",
            deployer: "",
            deployedAt: "",
            implementationV2: "",
            upgradeTransaction: "",
            upgradedAt: "",
            testNFT: "",
            factory: ""
        },
        
        // 主网
        mainnet: {
            chainId: 1,
            rpc: "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
            proxy: "",
            implementation: "",
            deployer: "",
            deployedAt: "",
            implementationV2: "",
            upgradeTransaction: "",
            upgradedAt: "",
            testNFT: "",
            factory: ""
        },
        
        // 配置元信息
        metadata: {
            version: "1.0.0",
            createdAt: new Date().toISOString(),
            description: "NFT拍卖平台部署配置文件",
            lastUpdated: new Date().toISOString()
        }
    };

    // 2. 检查是否已存在配置文件
    const configPath = 'deployments.json';
    let existingConfig = null;
    
    if (fs.existsSync(configPath)) {
        console.log("📂 发现现有配置文件，合并配置...");
        try {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // 合并现有配置，保留已有的部署数据
            Object.keys(deploymentConfig).forEach(network => {
                if (existingConfig[network] && typeof existingConfig[network] === 'object') {
                    deploymentConfig[network] = {
                        ...deploymentConfig[network],
                        ...existingConfig[network]
                    };
                }
            });
            
            // 更新元信息
            if (existingConfig.metadata) {
                deploymentConfig.metadata = {
                    ...deploymentConfig.metadata,
                    version: existingConfig.metadata.version || "1.0.0",
                    createdAt: existingConfig.metadata.createdAt || new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
            }
            
            console.log("✅ 现有配置已合并");
        } catch (error) {
            console.log("⚠️ 现有配置文件格式错误，将创建新配置");
        }
    }

    // 3. 写入配置文件
    try {
        fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
        console.log("✅ 配置文件已生成:", configPath);
    } catch (error) {
        console.error("❌ 配置文件写入失败:", error.message);
        return;
    }

    // 4. 显示配置文件结构
    console.log("\n📊 配置文件结构:");
    console.log("├── localhost (本地开发)");
    console.log("├── goerli (测试网)"); 
    console.log("├── sepolia (测试网)");
    console.log("├── mainnet (主网)");
    console.log("└── metadata (元信息)");

    console.log("\n🔧 每个网络包含以下字段:");
    const networkFields = Object.keys(deploymentConfig.localhost);
    networkFields.forEach((field, index) => {
        const isLast = index === networkFields.length - 1;
        console.log(`${isLast ? '└──' : '├──'} ${field}`);
    });

    // 5. 演示配置文件的使用方式
    console.log("\n💡 使用示例:");
    console.log(`
    // 读取配置
    const deployments = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
    const proxyAddress = deployments.localhost?.proxy;
    
    // 更新配置
    deployments.localhost.proxy = "0x1234...";
    deployments.localhost.deployedAt = new Date().toISOString();
    fs.writeFileSync('deployments.json', JSON.stringify(deployments, null, 2));
    `);

    console.log("\n📋 配置文件生成完成！");
    
    // 6. 如果在localhost网络，尝试获取当前网络信息
    try {
        const network = await ethers.provider.getNetwork();
        const [deployer] = await ethers.getSigners();
        
        if (network.chainId === 31337) {
            console.log("\n🌐 当前网络信息:");
            console.log("   - 网络:", network.name || 'localhost');
            console.log("   - ChainId:", network.chainId);
            console.log("   - 部署者:", deployer.address);
            console.log("   - 余额:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
            
            // 更新localhost配置中的部署者信息
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (!config.localhost.deployer) {
                config.localhost.deployer = deployer.address;
                config.metadata.lastUpdated = new Date().toISOString();
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log("✅ 已更新localhost部署者信息");
            }
        }
    } catch (error) {
        console.log("ℹ️ 无法获取网络信息 (可能未连接到节点)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 配置文件生成失败:", error);
        process.exit(1);
    });