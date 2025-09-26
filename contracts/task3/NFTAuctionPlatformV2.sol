// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./NFTAuctionPlatform.sol";

/**
 * @title NFTAuctionPlatformV2
 * @dev NFT 拍卖平台升级版本，添加了新功能
 */
contract NFTAuctionPlatformV2 is NFTAuctionPlatform {
    // 新版本添加的功能
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    // 拍卖类型枚举
    enum AuctionType {
        ENGLISH,     // 英式拍卖（价格递增）
        DUTCH,       // 荷兰式拍卖（价格递减）
        SEALED_BID   // 密封出价拍卖
    }
    
    // 扩展的拍卖结构
    struct AuctionV2 {
        AuctionType auctionType;    // 拍卖类型
        uint256 decreaseRate;       // 荷兰式拍卖的价格递减率（每小时）
        uint256 revealDeadline;     // 密封出价拍卖的揭示截止时间
        uint256 buyNowPrice;        // 一口价购买价格
        bool allowBuyNow;           // 是否允许一口价购买
        uint256 minimumBidIncrement; // 最小出价增量
        address[] bidTokenWhitelist; // 允许的出价代币白名单
        bool isWhitelistEnabled;    // 是否启用白名单
    }
    
    // 密封出价结构
    struct SealedBid {
        bytes32 commitment;         // 出价承诺（哈希）
        uint256 deposit;           // 保证金
        bool revealed;             // 是否已揭示
        uint256 actualBid;         // 实际出价（揭示后）
        address bidToken;          // 出价代币
    }
    
    // 存储扩展信息
    mapping(uint256 => AuctionV2) public auctionsV2;
    
    // 密封出价存储 (auctionId => bidder => SealedBid)
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;
    
    // 拍卖ID到参与者列表的映射
    mapping(uint256 => address[]) public auctionParticipants;
    
    // 拍卖统计信息
    struct AuctionStats {
        uint256 totalBids;
        uint256 uniqueBidders;
        uint256 averageBidAmount;
        uint256 lastBidTime;
    }
    
    mapping(uint256 => AuctionStats) public auctionStats;
    
    // 用户拍卖历史
    mapping(address => uint256[]) public userParticipatedAuctions;
    mapping(address => uint256[]) public userWonAuctions;
    
    // 批量操作支持
    struct BatchCreateParams {
        uint256 duration;
        uint256 startPrice;
        uint256 reservePrice;
        address nftContract;
        uint256[] tokenIds;
        AuctionType auctionType;
        uint256 buyNowPrice;
    }
    
    // 新事件
    event AuctionV2Created(
        uint256 indexed auctionId,
        AuctionType indexed auctionType,
        uint256 buyNowPrice,
        uint256 minimumBidIncrement
    );
    
    event BuyNowPurchase(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 price,
        address paymentToken
    );
    
    event SealedBidCommitted(
        uint256 indexed auctionId,
        address indexed bidder,
        bytes32 commitment,
        uint256 deposit
    );
    
    event SealedBidRevealed(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 actualBid
    );
    
    event DutchAuctionPriceUpdate(
        uint256 indexed auctionId,
        uint256 currentPrice,
        uint256 timestamp
    );
    
    event BatchAuctionCreated(
        uint256[] auctionIds,
        address indexed creator,
        AuctionType auctionType
    );
    
    /**
     * @dev 重新初始化函数（用于升级）
     */
    function initializeV2() external reinitializer(2) {
        // V2 版本的初始化逻辑
        // 这里可以添加新版本特有的初始化代码
    }
    
    /**
     * @dev 创建 V2 版本的拍卖
     */
    function createAuctionV2(
        uint256 duration,
        uint256 startPrice,
        uint256 reservePrice,
        address nftAddress,
        uint256 tokenId,
        AuctionType auctionType,
        uint256 buyNowPrice,
        uint256 minimumBidIncrement,
        address[] calldata bidTokenWhitelist
    ) external nonReentrant returns (uint256) {
        // 调用父合约的创建拍卖函数
        uint256 auctionId = nextAuctionId++;
        
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner of NFT");
        require(nft.isApprovedForAll(msg.sender, address(this)) || 
                nft.getApproved(tokenId) == address(this), "NFT not approved");
        
        // 转移 NFT 到合约
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        
        auctions[auctionId] = Auction({
            seller: msg.sender,
            duration: duration,
            startPrice: startPrice,
            startTime: block.timestamp,
            ended: false,
            highestBidder: address(0),
            highestBid: 0,
            nftContract: nftAddress,
            tokenId: tokenId,
            bidToken: address(0),
            originalBidAmount: 0,
            reservePrice: reservePrice
        });
        
        emit AuctionCreated(auctionId, msg.sender, nftAddress, tokenId, startPrice, reservePrice, duration);
        
        // 设置 V2 特有的属性
        AuctionV2 storage auctionV2 = auctionsV2[auctionId];
        auctionV2.auctionType = auctionType;
        auctionV2.buyNowPrice = buyNowPrice;
        auctionV2.allowBuyNow = buyNowPrice > 0;
        auctionV2.minimumBidIncrement = minimumBidIncrement;
        auctionV2.bidTokenWhitelist = bidTokenWhitelist;
        auctionV2.isWhitelistEnabled = bidTokenWhitelist.length > 0;
        
        if (auctionType == AuctionType.DUTCH) {
            require(reservePrice < startPrice, "Invalid price range for Dutch auction");
            auctionV2.decreaseRate = (startPrice - reservePrice) / (duration / 1 hours);
        } else if (auctionType == AuctionType.SEALED_BID) {
            auctionV2.revealDeadline = block.timestamp + duration + 1 days; // 出价结束后1天内揭示
        }
        
        // 初始化统计信息
        auctionStats[auctionId] = AuctionStats({
            totalBids: 0,
            uniqueBidders: 0,
            averageBidAmount: 0,
            lastBidTime: 0
        });
        
        emit AuctionV2Created(auctionId, auctionType, buyNowPrice, minimumBidIncrement);
        return auctionId;
    }
    
    /**
     * @dev 批量创建拍卖
     */
    function batchCreateAuctions(BatchCreateParams calldata params) 
        external 
        nonReentrant 
        returns (uint256[] memory) 
    {
        require(params.tokenIds.length > 0, "No tokens provided");
        require(params.tokenIds.length <= 50, "Too many tokens"); // 限制批量数量
        
        uint256[] memory auctionIds = new uint256[](params.tokenIds.length);
        
        for (uint256 i = 0; i < params.tokenIds.length; i++) {
            auctionIds[i] = this.createAuctionV2(
                params.duration,
                params.startPrice,
                params.reservePrice,
                params.nftContract,
                params.tokenIds[i],
                params.auctionType,
                params.buyNowPrice,
                0, // minimumBidIncrement
                new address[](0) // bidTokenWhitelist
            );
        }
        
        emit BatchAuctionCreated(auctionIds, msg.sender, params.auctionType);
        return auctionIds;
    }
    
    /**
     * @dev 一口价购买
     */
    function buyNow(uint256 auctionId, address paymentToken) external payable nonReentrant {
        Auction memory auction = auctions[auctionId];
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction ended");
        require(auctionV2.allowBuyNow, "Buy now not available");
        require(msg.sender != auction.seller, "Seller cannot buy");
        
        // 检查支付
        uint256 usdPrice = auctionV2.buyNowPrice;
        if (paymentToken == address(0)) {
            uint256 usdValue = getTokenPriceInUSD(address(0), msg.value);
            require(usdValue >= usdPrice, "Insufficient payment");
        } else {
            require(_isTokenWhitelisted(auctionId, paymentToken), "Token not whitelisted");
            uint256 requiredAmount = _calculateTokenAmount(paymentToken, usdPrice);
            IERC20(paymentToken).transferFrom(msg.sender, address(this), requiredAmount);
        }
        
        // 结束拍卖
        auctions[auctionId].ended = true;
        auctions[auctionId].highestBidder = msg.sender;
        auctions[auctionId].highestBid = usdPrice;
        auctions[auctionId].bidToken = paymentToken;
        
        // 执行交易
        _executeSuccessfulAuction(auctionId, auctions[auctionId]);
        
        // 更新用户历史
        userWonAuctions[msg.sender].push(auctionId);
        
        emit BuyNowPurchase(auctionId, msg.sender, usdPrice, paymentToken);
    }
    
    /**
     * @dev 提交密封出价的承诺
     */
    function commitSealedBid(
        uint256 auctionId,
        bytes32 commitment
    ) external payable nonReentrant {
        Auction memory auction = auctions[auctionId];
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction ended");
        require(auctionV2.auctionType == AuctionType.SEALED_BID, "Not a sealed bid auction");
        require(block.timestamp < auction.startTime + auction.duration, "Bidding period ended");
        require(msg.value > 0, "Must send deposit");
        
        SealedBid storage bid = sealedBids[auctionId][msg.sender];
        require(bid.commitment == bytes32(0), "Already committed");
        
        bid.commitment = commitment;
        bid.deposit = msg.value;
        bid.revealed = false;
        
        // 添加到参与者列表
        auctionParticipants[auctionId].push(msg.sender);
        userParticipatedAuctions[msg.sender].push(auctionId);
        
        emit SealedBidCommitted(auctionId, msg.sender, commitment, msg.value);
    }
    
    /**
     * @dev 揭示密封出价
     */
    function revealSealedBid(
        uint256 auctionId,
        uint256 bidAmount,
        address bidToken,
        uint256 nonce
    ) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        require(auction.ended, "Auction not ended");
        require(auctionV2.auctionType == AuctionType.SEALED_BID, "Not a sealed bid auction");
        require(block.timestamp <= auctionV2.revealDeadline, "Reveal period ended");
        
        SealedBid storage bid = sealedBids[auctionId][msg.sender];
        require(bid.commitment != bytes32(0), "No commitment found");
        require(!bid.revealed, "Already revealed");
        
        // 验证承诺
        bytes32 hash = keccak256(abi.encodePacked(bidAmount, bidToken, nonce, msg.sender));
        require(hash == bid.commitment, "Invalid reveal");
        
        bid.revealed = true;
        bid.actualBid = bidAmount;
        bid.bidToken = bidToken;
        
        // 转换为美元价值
        uint256 usdValue = getTokenPriceInUSD(bidToken, bidAmount);
        
        // 检查是否为最高出价
        if (usdValue > auction.highestBid) {
            auction.highestBidder = msg.sender;
            auction.highestBid = usdValue;
            auction.bidToken = bidToken;
            auction.originalBidAmount = bidAmount;
        }
        
        emit SealedBidRevealed(auctionId, msg.sender, bidAmount);
    }
    
    /**
     * @dev 获取荷兰式拍卖的当前价格
     */
    function getDutchAuctionCurrentPrice(uint256 auctionId) external view returns (uint256) {
        Auction memory auction = auctions[auctionId];
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        require(auctionV2.auctionType == AuctionType.DUTCH, "Not a Dutch auction");
        require(!auction.ended, "Auction ended");
        
        uint256 timeElapsed = block.timestamp - auction.startTime;
        uint256 priceDecrease = (timeElapsed / 1 hours) * auctionV2.decreaseRate;
        
        if (priceDecrease >= auction.startPrice - auction.reservePrice) {
            return auction.reservePrice;
        }
        
        return auction.startPrice - priceDecrease;
    }
    
    /**
     * @dev 获取拍卖统计信息
     */
    function getAuctionStats(uint256 auctionId) external view returns (AuctionStats memory) {
        return auctionStats[auctionId];
    }
    
    /**
     * @dev 获取用户参与的拍卖列表
     */
    function getUserParticipatedAuctions(address user) external view returns (uint256[] memory) {
        return userParticipatedAuctions[user];
    }
    
    /**
     * @dev 获取用户赢得的拍卖列表
     */
    function getUserWonAuctions(address user) external view returns (uint256[] memory) {
        return userWonAuctions[user];
    }
    
    /**
     * @dev 获取拍卖参与者列表
     */
    function getAuctionParticipants(uint256 auctionId) external view returns (address[] memory) {
        return auctionParticipants[auctionId];
    }
    
    /**
     * @dev 检查代币是否在白名单中
     */
    function _isTokenWhitelisted(uint256 auctionId, address token) internal view returns (bool) {
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        if (!auctionV2.isWhitelistEnabled) {
            return true;
        }
        
        for (uint256 i = 0; i < auctionV2.bidTokenWhitelist.length; i++) {
            if (auctionV2.bidTokenWhitelist[i] == token) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev 根据美元价值计算所需的代币数量
     */
    function _calculateTokenAmount(address token, uint256 usdValue) internal view returns (uint256) {
        AggregatorV3Interface priceFeed = priceFeeds[token];
        require(address(priceFeed) != address(0), "Price feed not set");
        
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        uint8 decimals = priceFeed.decimals();
        uint256 priceInUSD = (uint256(price) * (10 ** 18)) / (10 ** decimals);
        
        return (usdValue * (10 ** 18)) / priceInUSD;
    }
    
    /**
     * @dev 重写父合约的出价函数以支持 V2 功能
     */
    function _placeBid(
        uint256 auctionId,
        address tokenAddress,
        uint256 amount,
        uint256 usdValue
    ) internal override {
        AuctionV2 memory auctionV2 = auctionsV2[auctionId];
        
        // 检查代币白名单
        require(_isTokenWhitelisted(auctionId, tokenAddress), "Token not whitelisted");
        
        // 检查最小出价增量
        if (auctionV2.minimumBidIncrement > 0) {
            Auction memory auction = auctions[auctionId];
            require(
                usdValue >= auction.highestBid + auctionV2.minimumBidIncrement,
                "Bid increment too small"
            );
        }
        
        // 检查拍卖类型
        if (auctionV2.auctionType == AuctionType.SEALED_BID) {
            revert("Use commitSealedBid for sealed bid auctions");
        }
        
        // 调用父合约的出价逻辑
        super._placeBid(auctionId, tokenAddress, amount, usdValue);
        
        // 更新统计信息
        AuctionStats storage stats = auctionStats[auctionId];
        stats.totalBids++;
        stats.lastBidTime = block.timestamp;
        
        // 检查是否为新的出价者
        bool isNewBidder = bidRecords[auctionId][msg.sender] == 0;
        if (isNewBidder) {
            stats.uniqueBidders++;
            auctionParticipants[auctionId].push(msg.sender);
            userParticipatedAuctions[msg.sender].push(auctionId);
        }
        
        // 更新平均出价
        stats.averageBidAmount = (stats.averageBidAmount * (stats.totalBids - 1) + usdValue) / stats.totalBids;
        
        // 荷兰式拍卖特殊处理
        if (auctionV2.auctionType == AuctionType.DUTCH) {
            uint256 currentPrice = this.getDutchAuctionCurrentPrice(auctionId);
            emit DutchAuctionPriceUpdate(auctionId, currentPrice, block.timestamp);
        }
    }
}