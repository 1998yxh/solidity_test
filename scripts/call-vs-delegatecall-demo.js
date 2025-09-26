const { ethers } = require("hardhat");

/**
 * call vs delegatecall 实际演示脚本
 * 通过实际测试展示两种调用方式的核心区别
 */
async function main() {
    console.log("🔍 call vs delegatecall 对比演示\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("👤 部署者:", deployer.address);
    console.log("👤 用户:", user.address);

    // 部署测试合约
    console.log("\n📦 部署测试合约...");
    
    // 1. 部署目标合约
    const TargetContract = await ethers.getContractFactory("CallTestTarget");
    const target = await TargetContract.deploy();
    await target.deployed();
    console.log("✅ 目标合约地址:", target.address);

    // 2. 部署调用者合约
    const CallerContract = await ethers.getContractFactory("CallTestCaller");
    const caller = await CallerContract.deploy();
    await caller.deployed();
    console.log("✅ 调用者合约地址:", caller.address);

    // 初始状态检查
    console.log("\n📊 初始状态检查:");
    console.log("   目标合约 value:", (await target.value()).toString());
    console.log("   目标合约 sender:", await target.sender());
    console.log("   调用者合约 value:", (await caller.value()).toString());
    console.log("   调用者合约 sender:", await caller.sender());

    console.log("\n" + "=".repeat(60));
    console.log("测试 1: 使用 call 调用");
    console.log("=".repeat(60));

    // 测试call调用
    console.log("🔄 执行 call 调用...");
    const callTx = await caller.testCall(target.address, 100);
    await callTx.wait();

    console.log("\n📊 call调用后的状态:");
    console.log("   目标合约 value:", (await target.value()).toString());
    console.log("   目标合约 sender:", await target.sender());
    console.log("   目标合约 contractAddress:", await target.contractAddress());
    console.log("   调用者合约 value:", (await caller.value()).toString());
    console.log("   调用者合约 sender:", await caller.sender());
    console.log("   调用者合约 contractAddress:", await caller.contractAddress());

    console.log("\n💡 call 调用分析:");
    console.log("   ✅ 目标合约的存储被修改");
    console.log("   ✅ msg.sender 是调用者合约地址");
    console.log("   ✅ address(this) 是目标合约地址");
    console.log("   ✅ 调用者合约的存储未被修改");

    console.log("\n" + "=".repeat(60));
    console.log("测试 2: 使用 delegatecall 调用");  
    console.log("=".repeat(60));

    // 重置目标合约状态
    await target.reset();
    
    // 测试delegatecall调用
    console.log("🔄 执行 delegatecall 调用...");
    const delegateCallTx = await caller.testDelegateCall(target.address, 200);
    await delegateCallTx.wait();

    console.log("\n📊 delegatecall调用后的状态:");
    console.log("   目标合约 value:", (await target.value()).toString());
    console.log("   目标合约 sender:", await target.sender());
    console.log("   目标合约 contractAddress:", await target.contractAddress());
    console.log("   调用者合约 value:", (await caller.value()).toString());
    console.log("   调用者合约 sender:", await caller.sender());
    console.log("   调用者合约 contractAddress:", await caller.contractAddress());

    console.log("\n💡 delegatecall 调用分析:");
    console.log("   ✅ 调用者合约的存储被修改");
    console.log("   ✅ msg.sender 保持原始调用者地址");
    console.log("   ✅ address(this) 是调用者合约地址");
    console.log("   ✅ 目标合约的存储未被修改");

    console.log("\n" + "=".repeat(60));
    console.log("测试 3: 模拟代理模式");
    console.log("=".repeat(60));

    // 部署简单代理合约
    const SimpleProxy = await ethers.getContractFactory("SimpleProxyDemo");
    const proxy = await SimpleProxy.deploy(target.address);
    await proxy.deployed();
    console.log("✅ 代理合约地址:", proxy.address);

    // 通过代理调用
    console.log("\n🔄 通过代理合约调用目标合约函数...");
    
    // 编码函数调用
    const updateData = target.interface.encodeFunctionData("updateState", [300]);
    
    // 通过代理的fallback函数调用
    const proxyTx = await deployer.sendTransaction({
        to: proxy.address,
        data: updateData,
        gasLimit: 100000
    });
    await proxyTx.wait();

    console.log("\n📊 代理调用后的状态:");
    const proxyAsTarget = TargetContract.attach(proxy.address);
    console.log("   代理合约 value:", (await proxyAsTarget.value()).toString());
    console.log("   代理合约 sender:", await proxyAsTarget.sender());
    console.log("   代理合约 contractAddress:", await proxyAsTarget.contractAddress());
    console.log("   目标合约 value:", (await target.value()).toString());

    console.log("\n💡 代理模式分析:");
    console.log("   ✅ 代理合约存储被修改 (value = 300)");
    console.log("   ✅ msg.sender 是原始部署者地址");
    console.log("   ✅ address(this) 是代理合约地址");
    console.log("   ✅ 目标合约存储保持不变");
    console.log("   🎯 这就是代理模式的核心机制！");

    console.log("\n" + "=".repeat(60));
    console.log("总结对比");
    console.log("=".repeat(60));

    console.log(`
┌─────────────────┬─────────────────┬─────────────────┐
│     调用方式     │   存储修改位置   │   上下文保持     │
├─────────────────┼─────────────────┼─────────────────┤
│      call       │   目标合约存储   │   目标合约上下文 │
│  delegatecall   │   调用者存储    │   调用者上下文   │
│    代理模式     │   代理合约存储   │   用户上下文     │
└─────────────────┴─────────────────┴─────────────────┘
    `);

    console.log("\n🎯 关键理解:");
    console.log("1. call: 在目标合约的上下文中执行，修改目标合约状态");
    console.log("2. delegatecall: 在调用者的上下文中执行目标代码，修改调用者状态");  
    console.log("3. 代理模式: 利用delegatecall在代理合约存储中执行实现合约逻辑");
    console.log("4. 这就是为什么升级后数据能保持在代理合约中的原理！");

    console.log("\n🚀 演示完成！");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 演示失败:", error);
        process.exit(1);
    });