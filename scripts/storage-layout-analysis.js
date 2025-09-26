const { ethers } = require("hardhat");

/**
 * 存储布局分析脚本
 * 演示代理合约的存储机制和EIP-1967标准槽位
 */
async function main() {
    console.log("🔍 代理合约存储布局分析\n");

    const [deployer] = await ethers.getSigners();
    console.log("👤 分析账户:", deployer.address);

    console.log("\n" + "=".repeat(60));
    console.log("第一部分：EIP-1967 标准存储槽位");
    console.log("=".repeat(60));

    // 1. 部署EIP-1967演示合约
    console.log("📦 部署EIP-1967演示合约...");
    const EIP1967Demo = await ethers.getContractFactory("EIP1967Demo");
    const eip1967 = await EIP1967Demo.deploy();
    await eip1967.deployed();
    console.log("✅ 合约地址:", eip1967.address);

    // 2. 设置常规存储变量 (注意：这里只是为了演示存储槽位，实际中通过setter函数)
    console.log("\n🔧 设置EIP-1967存储槽位...");

    // 3. 设置EIP-1967标准槽位
    const mockImplementation = "0x1234567890123456789012345678901234567890";
    const mockAdmin = "0x0987654321098765432109876543210987654321";
    
    console.log("🔧 设置EIP-1967存储槽位...");
    await eip1967.setImplementation(mockImplementation);
    await eip1967.setAdmin(mockAdmin);

    // 4. 读取存储槽位
    console.log("\n📊 存储槽位分析:");
    
    // 常规槽位 (0, 1, 2, ...)
    const slot0 = await ethers.provider.getStorageAt(eip1967.address, 0);
    const slot1 = await ethers.provider.getStorageAt(eip1967.address, 1);
    const slot2 = await ethers.provider.getStorageAt(eip1967.address, 2);
    
    console.log("   常规存储槽位:");
    console.log(`     slot 0: ${slot0} (regularValue1)`);
    console.log(`     slot 1: ${slot1} (regularValue2)`);
    console.log(`     slot 2: ${slot2} (regularAddress)`);

    // EIP-1967标准槽位
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    
    const implSlot = await ethers.provider.getStorageAt(eip1967.address, IMPLEMENTATION_SLOT);
    const adminSlot = await ethers.provider.getStorageAt(eip1967.address, ADMIN_SLOT);
    
    console.log("   EIP-1967标准槽位:");
    console.log(`     实现槽位 (${IMPLEMENTATION_SLOT}):`);
    console.log(`       ${implSlot}`);
    console.log(`     管理槽位 (${ADMIN_SLOT}):`);
    console.log(`       ${adminSlot}`);

    console.log("\n💡 重要观察:");
    console.log("   ✅ 常规变量使用连续槽位 (0,1,2,...)");
    console.log("   ✅ EIP-1967槽位使用特殊计算的槽位");
    console.log("   ✅ 特殊槽位远离常规槽位，避免冲突");

    console.log("\n" + "=".repeat(60));
    console.log("第二部分：实际代理合约存储分析");
    console.log("=".repeat(60));

    // 检查现有的代理合约
    const deployments = require('../deployments.json');
    const proxyAddress = deployments.localhost?.proxy;
    
    if (proxyAddress && proxyAddress !== "") {
        console.log("🔍 分析现有代理合约:", proxyAddress);
        
        // 读取代理合约的实现地址
        const currentImpl = await ethers.provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
        console.log("   当前实现地址:", ethers.utils.getAddress("0x" + currentImpl.slice(-40)));
        
        // 读取一些常规存储槽位
        console.log("\n📊 代理合约存储状态:");
        for (let i = 0; i < 5; i++) {
            const slotValue = await ethers.provider.getStorageAt(proxyAddress, i);
            console.log(`   slot ${i}: ${slotValue}`);
        }

        // 通过代理合约读取业务数据
        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        const proxyAsContract = NFTAuctionPlatform.attach(proxyAddress);
        
        try {
            const owner = await proxyAsContract.owner();
            const auctionCounter = await proxyAsContract.auctionCounter();
            
            console.log("\n🎯 业务数据读取:");
            console.log("   合约Owner:", owner);
            console.log("   拍卖计数器:", auctionCounter.toString());
        } catch (error) {
            console.log("ℹ️ 无法读取业务数据 (可能合约未初始化)");
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("第三部分：存储冲突演示");
    console.log("=".repeat(60));

    // 部署存储冲突演示合约
    console.log("📦 部署存储冲突演示合约...");
    const StorageConflictDemo = await ethers.getContractFactory("StorageConflictDemo");
    const storageDemo = await StorageConflictDemo.deploy();
    await storageDemo.deployed();

    // 设置一些值
    await storageDemo.setValues(100, 200);
    await storageDemo.setBalance(deployer.address, 1000);

    console.log("\n📊 存储冲突演示 - 正常存储布局:");
    
    // 读取存储槽位
    for (let i = 0; i < 4; i++) {
        const slotValue = await ethers.provider.getStorageAt(storageDemo.address, i);
        let description = "";
        switch(i) {
            case 0: description = "(owner)"; break;
            case 1: description = "(value1)"; break;
            case 2: description = "(value2)"; break;
            case 3: description = "(balances mapping根)"; break;
        }
        console.log(`   slot ${i}: ${slotValue} ${description}`);
    }

    // 计算mapping的存储位置
    const balanceSlot = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "uint256"],
            [deployer.address, 3] // 3是balances mapping的槽位
        )
    );
    
    const balanceValue = await ethers.provider.getStorageAt(storageDemo.address, balanceSlot);
    console.log(`   balance[${deployer.address}]: ${parseInt(balanceValue, 16)} (slot: ${balanceSlot})`);

    console.log("\n💡 存储布局规律:");
    console.log("   📍 基础类型按声明顺序占用连续槽位");
    console.log("   📍 mapping类型的值存储在计算槽位: keccak256(key + slot)");
    console.log("   📍 EIP-1967用特殊槽位避免与常规存储冲突");

    console.log("\n" + "=".repeat(60));
    console.log("第四部分：升级安全检查");
    console.log("=".repeat(60));

    console.log("🔍 分析V1和V2合约的存储兼容性...");
    
    // 这里可以添加更多的兼容性检查逻辑
    console.log("✅ 存储布局分析要点:");
    console.log("   1. 新版本只能在末尾添加变量");
    console.log("   2. 不能改变现有变量的类型和位置");
    console.log("   3. 不能删除现有变量");
    console.log("   4. 使用__gap预留空间供未来升级");

    console.log("\n🎯 最佳实践:");
    console.log("   🔹 使用OpenZeppelin的存储布局检查工具");
    console.log("   🔹 在测试网充分测试升级兼容性");
    console.log("   🔹 为每个可升级合约预留存储gap");
    console.log("   🔹 记录每次升级的存储变化");

    console.log("\n📚 参考资源:");
    console.log("   🔗 EIP-1967: https://eips.ethereum.org/EIPS/eip-1967");
    console.log("   🔗 OpenZeppelin Upgrades: https://docs.openzeppelin.com/upgrades");
    console.log("   🔗 Storage Layout: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html");

    console.log("\n🎉 存储布局分析完成！");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 分析失败:", error);
        process.exit(1);
    });