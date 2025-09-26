const { ethers, upgrades } = require("hardhat");

/**
 * 升级验证测试脚本 - 逐项检查为什么会失败
 */
async function main() {
    console.log("🔍 升级验证测试脚本\n");

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
        console.log("\n" + "=".repeat(60));
        console.log("第一步：基础验证");
        console.log("=".repeat(60));

        // 检查V1合约
        console.log("🔍 检查V1合约结构...");
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        console.log("✅ V1合约工厂创建成功");
        
        // 检查V2合约
        console.log("🔍 检查V2合约结构...");
        const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");
        console.log("✅ V2合约工厂创建成功");

        console.log("\n" + "=".repeat(60));
        console.log("第二步：OpenZeppelin 升级安全检查");
        console.log("=".repeat(60));

        // 1. 检查V2合约的升级安全性（不指定代理地址）
        console.log("🔍 检查V2合约升级安全性...");
        try {
            await upgrades.validateImplementation(NFTAuctionPlatformV2);
            console.log("✅ V2实现合约通过安全检查");
        } catch (error) {
            console.log("❌ V2实现合约安全检查失败:");
            console.log("   错误:", error.message);
            
            // 分析具体的安全问题
            if (error.message.includes("Missing initializer")) {
                console.log("   📝 问题分析: 缺少初始化函数");
                console.log("   📝 原因: OpenZeppelin要求升级合约有正确的初始化设置");
            }
            if (error.message.includes("constructor")) {
                console.log("   📝 问题分析: 构造函数问题");
                console.log("   📝 原因: 构造函数没有正确禁用初始化");
            }
        }

        // 2. 检查从V1到V2的升级兼容性
        console.log("\n🔍 检查V1→V2升级兼容性...");
        try {
            await upgrades.validateUpgrade(PROXY_ADDRESS, NFTAuctionPlatformV2);
            console.log("✅ V1→V2升级兼容性检查通过");
        } catch (error) {
            console.log("❌ V1→V2升级兼容性检查失败:");
            console.log("   错误:", error.message);
            
            if (error.message.includes("storage layout")) {
                console.log("   📝 问题分析: 存储布局不兼容");
                console.log("   📝 原因: V2改变了V1的存储变量位置或类型");
            }
            if (error.message.includes("Missing initializer")) {
                console.log("   📝 问题分析: V2缺少正确的初始化函数");
            }
        }

        console.log("\n" + "=".repeat(60));
        console.log("第三步：具体的安全检查项目");
        console.log("=".repeat(60));

        // 检查各个具体的安全项
        const unsafeItems = [
            'missing-public-upgradeto',
            'delegatecall', 
            'constructor',
            'state-variable-immutable',
            'state-variable-assignment',
            'external-library-linking'
        ];

        for (const item of unsafeItems) {
            console.log(`\n🔍 检查安全项: ${item}`);
            try {
                await upgrades.validateImplementation(NFTAuctionPlatformV2, {
                    unsafeAllow: unsafeItems.filter(i => i !== item) // 排除当前检查项
                });
                console.log(`✅ ${item}: 通过`);
            } catch (error) {
                if (error.message.includes(item) || 
                    (item === 'missing-public-upgradeto' && error.message.includes('Missing initializer')) ||
                    (item === 'constructor' && error.message.includes('constructor'))) {
                    console.log(`❌ ${item}: 失败`);
                    console.log(`   原因: ${error.message.split('\n')[0]}`);
                } else {
                    console.log(`⚠️ ${item}: 其他错误 - ${error.message.split('\n')[0]}`);
                }
            }
        }

        console.log("\n" + "=".repeat(60));
        console.log("第四步：存储布局分析");
        console.log("=".repeat(60));

        // 尝试获取存储布局信息
        console.log("🔍 分析存储布局...");
        try {
            // 这里我们尝试理解为什么存储布局检查会失败
            console.log("V1合约继承链:");
            console.log("  - Initializable");
            console.log("  - UUPSUpgradeable");  
            console.log("  - OwnableUpgradeable");
            console.log("  - ReentrancyGuardUpgradeable");
            console.log("  - IERC721Receiver");

            console.log("\nV2合约继承链:");
            console.log("  - NFTAuctionPlatform (包含上述所有)");
            console.log("  - 新增存储变量");

            console.log("\n💡 存储布局规则:");
            console.log("  ✅ 可以在末尾添加新变量");
            console.log("  ❌ 不能修改现有变量的位置或类型");
            console.log("  ❌ 不能删除现有变量");
            console.log("  ❌ 不能改变继承顺序");

        } catch (error) {
            console.log("❌ 存储布局分析失败:", error.message);
        }

        console.log("\n" + "=".repeat(60));
        console.log("第五步：解决方案建议");
        console.log("=".repeat(60));

        console.log("🔧 针对检查失败的解决方案:");
        console.log("\n1️⃣ 初始化函数问题:");
        console.log("   - 确保V2有正确的 reinitializer(2) 函数");
        console.log("   - 添加 @custom:oz-upgrades-from <V1合约> 注释");
        
        console.log("\n2️⃣ 构造函数问题:");
        console.log("   - 添加 /// @custom:oz-upgrades-unsafe-allow constructor");
        console.log("   - 在构造函数中调用 _disableInitializers()");
        
        console.log("\n3️⃣ 绕过检查的方法:");
        console.log("   - 使用 unsafeAllow 参数");
        console.log("   - 使用直接调用 upgradeToAndCall");
        console.log("   - 在测试环境中禁用严格检查");

        console.log("\n4️⃣ 为什么直接升级会成功:");
        console.log("   - 跳过了所有 OpenZeppelin 插件检查");
        console.log("   - 直接调用 UUPS 合约的升级函数");
        console.log("   - 只进行最基本的权限验证");
        console.log("   - 不检查存储布局和初始化函数");

    } catch (error) {
        console.error("❌ 验证过程出错:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 脚本执行失败:", error);
        process.exit(1);
    });