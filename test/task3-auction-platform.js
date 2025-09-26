const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFT 拍卖平台完整测试", function () {
    // 部署测试夹具
    async function deployAuctionPlatformFixture() {
        const [owner, seller, bidder1, bidder2, bidder3] = await ethers.getSigners();

        // 1. 部署 NFT 合约
        const AuctionNFT = await ethers.getContractFactory("AuctionNFT");
        const nft = await AuctionNFT.deploy("Test NFT", "TNFT", "https://test.com/");

        // 2. 部署价格预言机
        const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
        const ethPriceFeed = await MockPriceFeed.deploy(8, "ETH/USD", 1, 200000000000); // $2000
        const usdtPriceFeed = await MockPriceFeed.deploy(8, "USDT/USD", 1, 100000000); // $1

        // 3. 部署测试代币
        const MyToken = await ethers.getContractFactory("MyToken");
        const usdt = await MyToken.deploy(ethers.utils.parseEther("1000000"));

        // 4. 部署拍卖工厂
        const NFTAuctionFactory = await ethers.getContractFactory("NFTAuctionFactory");
        const factory = await NFTAuctionFactory.deploy();

        // 5. 配置价格预言机
        await factory.addDefaultPriceFeed(ethers.constants.AddressZero, ethPriceFeed.address);
        await factory.addDefaultPriceFeed(usdt.address, usdtPriceFeed.address);

        // 6. 创建拍卖平台
        const createTx = await factory.createAuctionPlatform();
        const receipt = await createTx.wait();
        const event = receipt.events?.find(e => e.event === 'AuctionPlatformCreated');
        const auctionPlatformAddress = event?.args?.auctionPlatform;

        const NFTAuctionPlatform = await ethers.getContractFactory("NFTAuctionPlatform");
        const auctionPlatform = NFTAuctionPlatform.attach(auctionPlatformAddress);

        // 7. 准备测试数据
        await nft.connect(seller).mint(seller.address, "token-1");
        await nft.connect(seller).mint(seller.address, "token-2");
        await nft.connect(seller).setApprovalForAll(auctionPlatform.address, true);

        // 8. 分发测试代币
        await usdt.transfer(bidder1.address, ethers.utils.parseEther("10000"));
        await usdt.transfer(bidder2.address, ethers.utils.parseEther("10000"));
        await usdt.transfer(bidder3.address, ethers.utils.parseEther("10000"));

        return {
            owner,
            seller,
            bidder1,
            bidder2,
            bidder3,
            nft,
            ethPriceFeed,
            usdtPriceFeed,
            usdt,
            factory,
            auctionPlatform
        };
    }

    describe("基础拍卖功能", function () {
        it("应该能够创建拍卖", async function () {
            const fixture = await deployAuctionPlatformFixture();
            const { seller, nft, auctionPlatform } = fixture;

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
            expect(event?.args?.startPrice).to.equal(ethers.utils.parseEther("100"));
        });

        it("应该能够使用 ETH 出价", async function () {
            const fixture = await deployAuctionPlatformFixture();
            const { seller, bidder1, nft, auctionPlatform } = fixture;

            // 创建拍卖
            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            // 使用 ETH 出价 - 0.1 ETH = $200 (假设 ETH = $2000)
            const bidAmount = ethers.utils.parseEther("0.1");
            await auctionPlatform.connect(bidder1).placeBidWithETH(1, { value: bidAmount });

            const auction = await auctionPlatform.getAuction(1);
            expect(auction.highestBidder).to.equal(bidder1.address);
        });

        it("应该能够使用 ERC20 代币出价", async function () {
            const { seller, bidder1, nft, usdt, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            // 创建拍卖
            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            // 授权代币
            const bidAmount = ethers.utils.parseEther("200"); // 200 USDT = $200
            await usdt.connect(bidder1).approve(auctionPlatform.address, bidAmount);

            // 使用 USDT 出价
            await auctionPlatform.connect(bidder1).placeBidWithToken(1, usdt.address, bidAmount);

            const auction = await auctionPlatform.getAuction(1);
            expect(auction.highestBidder).to.equal(bidder1.address);
        });

        it("应该能够正确结束拍卖", async function () {
            const { seller, bidder1, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            // 创建拍卖
            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            // 出价
            const bidAmount = ethers.utils.parseEther("0.1"); // $200
            await auctionPlatform.connect(bidder1).placeBidWithETH(1, { value: bidAmount });

            // 快进时间
            await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25小时后
            await ethers.provider.send("evm_mine");

            // 结束拍卖
            await auctionPlatform.endAuction(1);

            // 检查 NFT 所有权
            expect(await nft.ownerOf(1)).to.equal(bidder1.address);

            const auction = await auctionPlatform.getAuction(1);
            expect(auction.ended).to.be.true;
        });
    });

    describe("价格预言机功能", function () {
        it("应该能够正确计算代币美元价值", async function () {
            const { auctionPlatform, usdt } = await loadFixture(deployAuctionPlatformFixture);

            const amount = ethers.utils.parseEther("100"); // 100 USDT
            const usdValue = await auctionPlatform.getTokenPriceInUSD(usdt.address, amount);
            
            // 100 USDT = $100 (考虑到18位小数)
            expect(usdValue).to.equal(ethers.utils.parseEther("100"));
        });

        it("应该能够更新价格预言机", async function () {
            const { owner, auctionPlatform, ethPriceFeed } = await loadFixture(deployAuctionPlatformFixture);

            // 更新 ETH 价格为 $3000
            await ethPriceFeed.updatePrice(300000000000); // $3000.00000000

            const amount = ethers.utils.parseEther("1"); // 1 ETH
            const usdValue = await auctionPlatform.getTokenPriceInUSD(ethers.constants.AddressZero, amount);
            
            expect(usdValue).to.equal(ethers.utils.parseEther("3000"));
        });
    });

    describe("工厂模式功能", function () {
        it("应该能够创建多个拍卖平台", async function () {
            const { owner, factory } = await loadFixture(deployAuctionPlatformFixture);

            const initialCount = await factory.allAuctionsLength();
            
            await factory.createAuctionPlatform();
            await factory.createAuctionPlatform();

            const finalCount = await factory.allAuctionsLength();
            expect(finalCount).to.equal(initialCount.add(2));
        });

        it("应该能够获取用户创建的拍卖平台", async function () {
            const { owner, factory } = await loadFixture(deployAuctionPlatformFixture);

            const userAuctionsBefore = await factory.getUserAuctions(owner.address);
            const countBefore = userAuctionsBefore.length;

            await factory.createAuctionPlatform();

            const userAuctionsAfter = await factory.getUserAuctions(owner.address);
            expect(userAuctionsAfter.length).to.equal(countBefore + 1);
        });
    });

    describe("升级功能测试", function () {
        it("应该能够部署 V2 实现合约", async function () {
            const NFTAuctionPlatformV2 = await ethers.getContractFactory("NFTAuctionPlatformV2");
            const v2Implementation = await NFTAuctionPlatformV2.deploy();
            
            expect(v2Implementation.address).to.not.equal(ethers.constants.AddressZero);
        });
    });

    describe("安全性测试", function () {
        it("非 NFT 所有者不能创建拍卖", async function () {
            const { bidder1, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await expect(
                auctionPlatform.connect(bidder1).createAuction(
                    24 * 60 * 60,
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("150"),
                    nft.address,
                    1
                )
            ).to.be.revertedWith("Not owner of NFT");
        });

        it("卖家不能对自己的拍卖出价", async function () {
            const { seller, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            await expect(
                auctionPlatform.connect(seller).placeBidWithETH(1, { 
                    value: ethers.utils.parseEther("0.1") 
                })
            ).to.be.revertedWith("Seller cannot bid");
        });

        it("出价必须高于当前最高出价", async function () {
            const { seller, bidder1, bidder2, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            // 第一次出价
            await auctionPlatform.connect(bidder1).placeBidWithETH(1, { 
                value: ethers.utils.parseEther("0.1") // $200
            });

            // 第二次出价必须更高
            await expect(
                auctionPlatform.connect(bidder2).placeBidWithETH(1, { 
                    value: ethers.utils.parseEther("0.05") // $100
                })
            ).to.be.revertedWith("Bid not high enough");
        });
    });

    describe("边界条件测试", function () {
        it("拍卖时间不能太短或太长", async function () {
            const { seller, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            // 测试时间太短
            await expect(
                auctionPlatform.connect(seller).createAuction(
                    30 * 60, // 30分钟
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("150"),
                    nft.address,
                    1
                )
            ).to.be.revertedWith("Invalid duration");

            // 测试时间太长
            await expect(
                auctionPlatform.connect(seller).createAuction(
                    40 * 24 * 60 * 60, // 40天
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("150"),
                    nft.address,
                    1
                )
            ).to.be.revertedWith("Invalid duration");
        });

        it("保留价格必须不低于起始价格", async function () {
            const { seller, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await expect(
                auctionPlatform.connect(seller).createAuction(
                    24 * 60 * 60,
                    ethers.utils.parseEther("150"), // 起始价格
                    ethers.utils.parseEther("100"), // 保留价格更低
                    nft.address,
                    1
                )
            ).to.be.revertedWith("Reserve price too low");
        });
    });

    describe("事件测试", function () {
        it("创建拍卖应该触发正确的事件", async function () {
            const { seller, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await expect(
                auctionPlatform.connect(seller).createAuction(
                    24 * 60 * 60,
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("150"),
                    nft.address,
                    1
                )
            ).to.emit(auctionPlatform, "AuctionCreated")
             .withArgs(1, seller.address, nft.address, 1, ethers.utils.parseEther("100"), ethers.utils.parseEther("150"), 24 * 60 * 60);
        });

        it("出价应该触发正确的事件", async function () {
            const { seller, bidder1, nft, auctionPlatform } = await loadFixture(deployAuctionPlatformFixture);

            await auctionPlatform.connect(seller).createAuction(
                24 * 60 * 60,
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("150"),
                nft.address,
                1
            );

            const bidAmount = ethers.utils.parseEther("0.1");
            const expectedUsdValue = ethers.utils.parseEther("200"); // 0.1 ETH * $2000

            await expect(
                auctionPlatform.connect(bidder1).placeBidWithETH(1, { value: bidAmount })
            ).to.emit(auctionPlatform, "BidPlaced")
             .withArgs(1, bidder1.address, ethers.constants.AddressZero, bidAmount, expectedUsdValue);
        });
    });
});