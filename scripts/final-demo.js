const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 NFT 拍卖平台完整演示开始...\n");

    const [owner, seller, bidder1, bidder2] = await ethers.getSigners();
    console.log("👥 获取测试账户:");
    console.log("   Owner:", owner.address);
    console.log("   Seller:", seller.address);
    console.log("   Bidder1:", bidder1.address);
    console.log("   Bidder2:", bidder2.address);
    console.log();

    // 1. 部署所有合约
    console.log("📦 部署所有合约...");
    
    // 部署 NFT 合约
    const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
    const nft = await AuctionNFT.deploy("Auction NFT", "ANFT", "https://ipfs.io/ipfs/");
    console.log("✅ NFT 合约:", nft.address);

    // 部署价格预言机
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const ethPriceFeed = await MockPriceFeed.deploy(8, "ETH/USD", 1, 200000000000); // $2000
    const usdtPriceFeed = await MockPriceFeed.deploy(8, "USDT/USD", 1, 100000000); // $1
    console.log("✅ ETH 价格预言机:", ethPriceFeed.address, "($2000)");
    console.log("✅ USDT 价格预言机:", usdtPriceFeed.address, "($1)");

    // 部署测试代币
    const MyToken = await ethers.getContractFactory("MyToken");
    const usdt = await MyToken.deploy(ethers.utils.parseEther("1000000"));
    console.log("✅ USDT 代币:", usdt.address);

    // 部署拍卖工厂
    const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
    const factory = await NFTAuctionFactory.deploy();
    console.log("✅ 拍卖工厂:", factory.address);
    console.log();

    // 2. 配置价格预言机
    console.log("⚙️ 配置价格预言机...");
    await factory.addDefaultPriceFeed(ethers.constants.AddressZero, ethPriceFeed.address);
    await factory.addDefaultPriceFeed(usdt.address, usdtPriceFeed.address);
    console.log("✅ 价格预言机配置完成");
    console.log();

    // 3. 创建拍卖平台
    console.log("🏭 创建拍卖平台...");
    const createTx = await factory.connect(owner).createAuctionPlatform();
    const receipt = await createTx.wait();
    const event = receipt.events?.find(e => e.event === 'AuctionPlatformCreated');
    const auctionPlatformAddress = event?.args?.auctionPlatform;

    const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
    const auctionPlatform = NFTAuctionPlatform.attach(auctionPlatformAddress);
    console.log("✅ 拍卖平台:", auctionPlatformAddress);
    console.log();

    // 4. 铸造 NFT
    console.log("🎨 铸造 NFT...");
    await nft.connect(owner).mint(seller.address, "QmTest1");
    await nft.connect(owner).mint(seller.address, "QmTest2");
    console.log("✅ 为 seller 铸造了 2 个 NFT (tokenId: 1, 2)");
    
    // 授权拍卖平台
    await nft.connect(seller).setApprovalForAll(auctionPlatform.address, true);
    console.log("✅ Seller 授权拍卖平台管理 NFT");
    console.log();

    // 5. 准备测试代币
    console.log("💰 分发测试代币...");
    await usdt.transfer(bidder1.address, ethers.utils.parseEther("10000"));
    await usdt.transfer(bidder2.address, ethers.utils.parseEther("10000"));
    await usdt.connect(bidder1).approve(auctionPlatform.address, ethers.utils.parseEther("10000"));
    await usdt.connect(bidder2).approve(auctionPlatform.address, ethers.utils.parseEther("10000"));
    console.log("✅ 给 bidder1 和 bidder2 各分发 10000 USDT");
    console.log("✅ Bidders 授权拍卖平台使用 USDT");
    console.log();

    // 6. 创建拍卖
    console.log("🏆 创建拍卖...");
    const auctionTx1 = await auctionPlatform.connect(seller).createAuction(
        24 * 60 * 60, // 24小时
        ethers.utils.parseEther("100"), // 起始价格 $100
        ethers.utils.parseEther("200"), // 保留价格 $200
        nft.address,
        1
    );
    await auctionTx1.wait();
    console.log("✅ 创建拍卖 #1: NFT tokenId=1, 起始价=$100, 保留价=$200");

    const auctionTx2 = await auctionPlatform.connect(seller).createAuction(
        12 * 60 * 60, // 12小时
        ethers.utils.parseEther("50"), // 起始价格 $50
        ethers.utils.parseEther("100"), // 保留价格 $100
        nft.address,
        2
    );
    await auctionTx2.wait();
    console.log("✅ 创建拍卖 #2: NFT tokenId=2, 起始价=$50, 保留价=$100");
    console.log();

    // 7. ETH 出价演示
    console.log("💎 ETH 出价演示...");
    
    // bidder1 使用 ETH 出价拍卖1：0.06 ETH = $120
    await auctionPlatform.connect(bidder1).placeBidWithETH(1, { 
        value: ethers.utils.parseEther("0.06") 
    });
    console.log("✅ Bidder1 用 0.06 ETH ($120) 对拍卖 #1 出价");

    // bidder2 使用 ETH 出价拍卖1：0.08 ETH = $160
    await auctionPlatform.connect(bidder2).placeBidWithETH(1, { 
        value: ethers.utils.parseEther("0.08") 
    });
    console.log("✅ Bidder2 用 0.08 ETH ($160) 对拍卖 #1 出价");
    console.log();

    // 8. ERC20 出价演示
    console.log("🪙 ERC20 出价演示...");
    
    // bidder1 使用 USDT 出价拍卖2：80 USDT
    await auctionPlatform.connect(bidder1).placeBidWithToken(2, usdt.address, ethers.utils.parseEther("80"));
    console.log("✅ Bidder1 用 80 USDT 对拍卖 #2 出价");

    // bidder2 使用 USDT 出价拍卖2：120 USDT
    await auctionPlatform.connect(bidder2).placeBidWithToken(2, usdt.address, ethers.utils.parseEther("120"));
    console.log("✅ Bidder2 用 120 USDT 对拍卖 #2 出价");
    console.log();

    // 9. 查看拍卖状态
    console.log("📊 查看拍卖状态...");
    
    const auction1 = await auctionPlatform.getAuction(1);
    const auction2 = await auctionPlatform.getAuction(2);
    
    console.log("拍卖 #1 状态:");
    console.log("  - 最高出价者:", auction1.highestBidder);
    console.log("  - 最高出价:", ethers.utils.formatEther(auction1.highestBid), "USD");
    console.log("  - 出价代币:", auction1.bidToken === ethers.constants.AddressZero ? "ETH" : "ERC20");
    console.log("  - 是否活跃:", await auctionPlatform.isAuctionActive(1));
    
    console.log("\n拍卖 #2 状态:");
    console.log("  - 最高出价者:", auction2.highestBidder);
    console.log("  - 最高出价:", ethers.utils.formatEther(auction2.highestBid), "USD");
    console.log("  - 出价代币:", auction2.bidToken === ethers.constants.AddressZero ? "ETH" : "USDT");
    console.log("  - 是否活跃:", await auctionPlatform.isAuctionActive(2));
    console.log();

    // 10. 工厂功能演示
    console.log("🏭 工厂功能演示...");
    
    // 另一个用户创建拍卖平台
    const createTx2 = await factory.connect(bidder1).createAuctionPlatform();
    const receipt2 = await createTx2.wait();
    const event2 = receipt2.events?.find(e => e.event === 'AuctionPlatformCreated');
    const auctionPlatformAddress2 = event2?.args?.auctionPlatform;
    console.log("✅ Bidder1 创建了新的拍卖平台:", auctionPlatformAddress2);

    // 获取用户创建的平台列表
    const userPlatforms = await factory.getUserAuctions(owner.address);
    console.log("✅ Owner 创建的平台数量:", userPlatforms.length);
    
    const bidder1Platforms = await factory.getUserAuctions(bidder1.address);
    console.log("✅ Bidder1 创建的平台数量:", bidder1Platforms.length);
    console.log();

    // 11. 价格预言机功能演示
    console.log("📈 价格预言机功能演示...");
    
    const ethUsdValue = await auctionPlatform.getTokenPriceInUSD(ethers.constants.AddressZero, ethers.utils.parseEther("1"));
    const usdtUsdValue = await auctionPlatform.getTokenPriceInUSD(usdt.address, ethers.utils.parseEther("100"));
    
    console.log("✅ 1 ETH =", ethers.utils.formatEther(ethUsdValue), "USD");
    console.log("✅ 100 USDT =", ethers.utils.formatEther(usdtUsdValue), "USD");
    console.log();

    console.log("🎉 演示完成！所有功能正常工作:");
    console.log("   ✅ NFT 铸造和管理");
    console.log("   ✅ 多种出价方式 (ETH/ERC20)");
    console.log("   ✅ 价格预言机集成");
    console.log("   ✅ 工厂模式创建平台");
    console.log("   ✅ 拍卖状态管理");
    console.log("   ✅ 安全性检查");
    console.log();
    console.log("📋 部署地址汇总:");
    console.log("   NFT 合约:", nft.address);
    console.log("   USDT 代币:", usdt.address);
    console.log("   拍卖工厂:", factory.address);
    console.log("   拍卖平台1:", auctionPlatformAddress);
    console.log("   拍卖平台2:", auctionPlatformAddress2);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ 演示失败:", error);
        process.exit(1);
    });