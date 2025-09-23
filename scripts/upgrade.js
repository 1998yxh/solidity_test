const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("开始升级 NFT 拍卖合约...");
  
  // 代理合约地址 (从部署结果获取)
  const proxyAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  
  // 获取 NftAuctionV2 合约工厂
  const NftAuctionV2 = await ethers.getContractFactory("NftAuctionV2");
  
  console.log("正在升级合约到 V2...");
  
  // 升级代理合约到 V2
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NftAuctionV2);
  
  console.log("合约升级成功!");
  console.log("代理合约地址:", upgraded.address);
  
  // 验证升级
  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("新实现合约地址:", newImpl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });