const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFT 拍卖平台基础测试", function () {
    let owner, seller, bidder1, bidder2;
    let nft, auctionPlatform, factory, usdt, ethPriceFeed;

    before(async function () {
        [owner, seller, bidder1, bidder2] = await ethers.getSigners();

        // 部署 NFT 合约
        const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
        nft = await AuctionNFT.deploy("Test NFT", "TNFT", "https://test.com/");

        // 部署价格预言机
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        ethPriceFeed = await MockPriceFeed.deploy(8, "ETH/USD", 1, 200000000000); // $2000

        // 部署测试代币
        const MyToken = await ethers.getContractFactory("MyToken");
        usdt = await MyToken.deploy(ethers.utils.parseEther("1000000"));

        // 部署拍卖工厂
        const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
        factory = await NFTAuctionFactory.deploy();

        // 配置价格预言机
        await factory.addDefaultPriceFeed(ethers.constants.AddressZero, ethPriceFeed.address);

        // 创建拍卖平台
        const createTx = await factory.createAuctionPlatform();
        const receipt = await createTx.wait();
        const event = receipt.events?.find(e => e.event === 'AuctionPlatformCreated');
        const auctionPlatformAddress = event?.args?.auctionPlatform;

        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        auctionPlatform = NFTAuctionPlatform.attach(auctionPlatformAddress);

        // 准备测试数据 - owner 铸造 NFT 给 seller
        await nft.connect(owner).mint(seller.address, "token-1");
        await nft.connect(seller).setApprovalForAll(auctionPlatform.address, true);
    });

    it("应该能够创建拍卖", async function () {
        const tx = await auctionPlatform.connect(seller).createAuction(
            24 * 60 * 60, // 24小时
            ethers.utils.parseEther("100"), // 起始价格 $100
            ethers.utils.parseEther("150"), // 保留价格 $150
            nft.address,
            1
        );

        const receipt = await tx.wait();
        const event = receipt.events?.find(e => e.event === 'AuctionCreated');
        
        expect(event).to.not.be.undefined;
        expect(event?.args?.seller).to.equal(seller.address);
        expect(event?.args?.startPrice.toString()).to.equal(ethers.utils.parseEther("100").toString());
    });

    it("应该能够使用 ETH 出价", async function () {
        // 使用 ETH 出价 - 0.1 ETH = $200 (假设 ETH = $2000)
        const bidAmount = ethers.utils.parseEther("0.1");
        await auctionPlatform.connect(bidder1).placeBidWithETH(1, { value: bidAmount });

        const auction = await auctionPlatform.getAuction(1);
        expect(auction.highestBidder).to.equal(bidder1.address);
    });

    it("应该能够获取拍卖信息", async function () {
        const auction = await auctionPlatform.getAuction(1);
        
        expect(auction.seller).to.equal(seller.address);
        expect(auction.nftContract).to.equal(nft.address);
        expect(auction.tokenId.toString()).to.equal("1");
        expect(auction.startPrice.toString()).to.equal(ethers.utils.parseEther("100").toString());
    });

    it("非 NFT 所有者不能创建拍卖", async function () {
        let errorOccurred = false;
        try {
            await auctionPlatform.connect(bidder1).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );
        } catch (error) {
            errorOccurred = true;
            expect(error.message).to.include("Not owner of NFT");
        }
        expect(errorOccurred).to.be.true;
    });

    it("卖家不能对自己的拍卖出价", async function () {
        let errorOccurred = false;
        try {
            await auctionPlatform.connect(seller).placeBidWithETH(1, { 
                value: ethers.utils.parseEther("0.1") 
            });
        } catch (error) {
            errorOccurred = true;
            expect(error.message).to.include("Seller cannot bid");
        }
        expect(errorOccurred).to.be.true;
    });

    it("应该能够检查拍卖是否活跃", async function () {
        const isActive = await auctionPlatform.isAuctionActive(1);
        expect(isActive).to.be.true;
    });

    it("应该能够获取剩余时间", async function () {
        const timeRemaining = await auctionPlatform.getTimeRemaining(1);
        expect(timeRemaining.toNumber()).to.be.greaterThan(0);
    });
});