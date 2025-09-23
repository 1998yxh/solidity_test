const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 开始完整的合约部署和升级演示...\n");
  
  // 步骤 1: 部署 MyToken
  console.log("📦 步骤 1: 部署 MyToken 合约");
  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy(1000000); // 1M tokens
  await myToken.deployed();
  console.log("✅ MyToken 部署完成:", myToken.address);
  console.log("💰 总供应量:", await myToken.totalSupply(), "wei\n");
  
  // 步骤 2: 部署 NftAuction 代理合约 (V1)
  console.log("📦 步骤 2: 部署 NftAuction V1 (代理模式)");
  const NftAuction = await ethers.getContractFactory("NftAuction");
  const nftAuctionProxy = await upgrades.deployProxy(NftAuction, [], {
    initializer: "initialize",
  });
  await nftAuctionProxy.deployed();
  
  const proxyAddress = nftAuctionProxy.address;
  const implV1Address = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("✅ NftAuction V1 部署完成");
  console.log("🔗 代理合约地址:", proxyAddress);
  console.log("🏗️ 实现合约地址 V1:", implV1Address);
  
  // 验证 V1 功能
  const admin = await nftAuctionProxy.admin();
  console.log("👤 合约管理员:", admin, "\n");
  
  // 步骤 3: 升级到 NftAuctionV2
  console.log("🔄 步骤 3: 升级 NftAuction 到 V2");
  const NftAuctionV2 = await ethers.getContractFactory("NftAuctionV2");
  
  console.log("📡 正在执行升级...");
  const upgradedProxy = await upgrades.upgradeProxy(proxyAddress, NftAuctionV2);
  await upgradedProxy.deployed();
  
  const implV2Address = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("✅ 升级完成!");
  console.log("🔗 代理合约地址 (不变):", upgradedProxy.address);
  console.log("🏗️ 新实现合约地址 V2:", implV2Address);
  
  // 验证升级后状态保持
  const adminAfterUpgrade = await upgradedProxy.admin();
  console.log("👤 升级后管理员 (应该不变):", adminAfterUpgrade);
  
  // 验证地址没有改变
  console.log("🔍 验证代理地址是否保持不变:", proxyAddress === upgradedProxy.address ? "✅ 是" : "❌ 否");
  console.log("🔍 验证实现地址是否改变:", implV1Address !== implV2Address ? "✅ 是" : "❌ 否");
  
  console.log("\n🎉 合约部署和升级演示完成!");
  console.log("\n📊 总结:");
  console.log("• MyToken 地址:", myToken.address);
  console.log("• NftAuction 代理地址:", proxyAddress);
  console.log("• NftAuction V1 实现地址:", implV1Address);
  console.log("• NftAuction V2 实现地址:", implV2Address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 错误:", error);
    process.exit(1);
  });