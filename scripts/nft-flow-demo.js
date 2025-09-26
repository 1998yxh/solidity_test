const { ethers } = require("hardhat");

async function demonstrateNFTAuctionFlow() {
    console.log("🔍 演示 NFT 从铸造到拍卖的完整流程\n");

    const [owner, seller, bidder] = await ethers.getSigners();

    // 1. 部署 NFT 合约
    const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
    const nft = await AuctionNFT.deploy("Demo NFT", "DEMO", "https://demo.com/");
    console.log("📦 部署 NFT 合约:", nft.address);

    // 2. 部署简单的拍卖平台
    const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
    const factory = await NFTAuctionFactory.deploy();
    
    const createTx = await factory.connect(owner).createAuctionPlatform();
    const receipt = await createTx.wait();
    const event = receipt.events?.find(e => e.event === 'AuctionPlatformCreated');
    const auctionPlatformAddress = event?.args?.auctionPlatform;

    const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
    const auctionPlatform = NFTAuctionPlatform.attach(auctionPlatformAddress);
    console.log("🏭 部署拍卖平台:", auctionPlatformAddress);

    console.log("\n" + "=".repeat(60));
    console.log("第一阶段：NFT 铸造");
    console.log("=".repeat(60));

    // 3. Owner 为 Seller 铸造 NFT
    console.log("🎨 Owner 为 Seller 铸造 NFT...");
    const mintTx = await nft.connect(owner).mint(seller.address, "demo-token-uri");
    const mintReceipt = await mintTx.wait();
    const mintEvent = mintReceipt.events?.find(e => e.event === 'NFTMinted');
    const tokenId = mintEvent?.args?.tokenId;

    console.log(`✅ NFT 铸造成功！`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   所有者: ${seller.address}`);
    console.log(`   URI: demo-token-uri`);

    // 4. 验证所有权
    const nftOwner = await nft.ownerOf(tokenId);
    console.log(`\n🔍 验证 NFT 所有权:`);
    console.log(`   NFT ${tokenId} 的所有者: ${nftOwner}`);
    console.log(`   Seller 地址: ${seller.address}`);
    console.log(`   所有权匹配: ${nftOwner === seller.address ? '✅' : '❌'}`);

    console.log("\n" + "=".repeat(60));
    console.log("第二阶段：授权拍卖平台");
    console.log("=".repeat(60));

    // 5. 检查授权状态 (创建拍卖前)
    let isApprovedForAll = await nft.isApprovedForAll(seller.address, auctionPlatform.address);
    let approvedAddress = await nft.getApproved(tokenId);
    
    console.log("🔐 授权状态检查 (授权前):");
    console.log(`   批量授权 (isApprovedForAll): ${isApprovedForAll ? '✅' : '❌'}`);
    console.log(`   单个授权 (getApproved): ${approvedAddress === auctionPlatform.address ? '✅' : '❌'}`);
    console.log(`   当前单个授权地址: ${approvedAddress}`);

    // 6. Seller 授权拍卖平台
    console.log("\n🔓 Seller 授权拍卖平台管理所有 NFT...");
    await nft.connect(seller).setApprovalForAll(auctionPlatform.address, true);
    
    // 7. 验证授权成功
    isApprovedForAll = await nft.isApprovedForAll(seller.address, auctionPlatform.address);
    console.log(`✅ 授权成功！批量授权状态: ${isApprovedForAll ? '✅' : '❌'}`);

    console.log("\n" + "=".repeat(60));
    console.log("第三阶段：创建拍卖");
    console.log("=".repeat(60));

    // 8. 创建拍卖
    console.log("🏆 Seller 创建拍卖...");
    
    // 记录拍卖前的 NFT 位置
    const ownerBeforeAuction = await nft.ownerOf(tokenId);
    console.log(`NFT 拍卖前位置: ${ownerBeforeAuction} (Seller)`);
    
    const auctionTx = await auctionPlatform.connect(seller).createAuction(
        24 * 60 * 60, // 24小时
        ethers.utils.parseEther("1"), // 起始价格 1 ETH
        ethers.utils.parseEther("2"), // 保留价格 2 ETH
        nft.address,
        tokenId
    );
    
    const auctionReceipt = await auctionTx.wait();
    const auctionEvent = auctionReceipt.events?.find(e => e.event === 'AuctionCreated');
    const auctionId = auctionEvent?.args?.auctionId || auctionEvent?.args?.[0];

    console.log(`✅ 拍卖创建成功！`);
    console.log(`   拍卖 ID: ${auctionId}`);
    
    // 9. 验证 NFT 转移
    const ownerAfterAuction = await nft.ownerOf(tokenId);
    console.log(`\n🔄 NFT 转移验证:`);
    console.log(`   拍卖前所有者: ${ownerBeforeAuction} (Seller)`);
    console.log(`   拍卖后所有者: ${ownerAfterAuction} (拍卖合约)`);
    console.log(`   NFT 成功托管: ${ownerAfterAuction === auctionPlatform.address ? '✅' : '❌'}`);

    console.log("\n" + "=".repeat(60));
    console.log("第四阶段：查看拍卖状态");
    console.log("=".repeat(60));

    // 10. 查看拍卖详情
    const auction = await auctionPlatform.auctions(auctionId);
    console.log("📊 拍卖详情:");
    console.log(`   卖家: ${auction.seller}`);
    console.log(`   NFT 合约: ${auction.nftContract}`);
    console.log(`   Token ID: ${auction.tokenId}`);
    console.log(`   起始价格: ${ethers.utils.formatEther(auction.startPrice)} ETH`);
    console.log(`   保留价格: ${ethers.utils.formatEther(auction.reservePrice)} ETH`);
    console.log(`   拍卖状态: ${auction.ended ? '已结束' : '进行中'}`);

    console.log("\n🎉 流程演示完成！");
    console.log("📝 总结:");
    console.log("   1. ✅ Owner 铸造 NFT 给 Seller");
    console.log("   2. ✅ Seller 授权拍卖平台管理 NFT");
    console.log("   3. ✅ Seller 创建拍卖");
    console.log("   4. ✅ NFT 自动转移到拍卖合约托管");
    console.log("   5. ✅ 拍卖开始，等待出价");

    return {
        nft: nft.address,
        auctionPlatform: auctionPlatform.address,
        tokenId: tokenId.toString(),
        auctionId: auctionId.toString()
    };
}

// 如果直接运行此脚本
if (require.main === module) {
    demonstrateNFTAuctionFlow()
        .then((result) => {
            console.log("\n📋 合约地址汇总:");
            console.log(`   NFT 合约: ${result.nft}`);
            console.log(`   拍卖平台: ${result.auctionPlatform}`);
            console.log(`   Token ID: ${result.tokenId}`);
            console.log(`   拍卖 ID: ${result.auctionId}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ 演示失败:", error);
            process.exit(1);
        });
}

module.exports = { demonstrateNFTAuctionFlow };