// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title NFTAuctionPlatform
 * @dev NFT 拍卖平台主合约，支持多种代币出价和 Chainlink 价格预言机
 */
contract NFTAuctionPlatform is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    IERC721Receiver 
{
    // 拍卖结构体
    struct Auction {
        address seller;           // 卖家
        uint256 duration;        // 拍卖持续时间
        uint256 startPrice;      // 起始价格 (美元，18位小数)
        uint256 startTime;       // 开始时间
        bool ended;              // 是否结束
        address highestBidder;   // 最高出价者
        uint256 highestBid;      // 最高出价 (美元，18位小数)
        address nftContract;     // NFT 合约地址
        uint256 tokenId;         // NFT Token ID
        address bidToken;        // 出价代币地址 (address(0) 表示 ETH)
        uint256 originalBidAmount; // 原始出价金额
        uint256 reservePrice;    // 保留价格 (美元，18位小数)
    }
    
    // 支持的代币价格预言机
    mapping(address => AggregatorV3Interface) public priceFeeds;
    
    // 跨链桥接合约地址
    address public crossChainBridge;

    // 拍卖存储
    mapping(uint256 => Auction) public auctions;
    uint256 public nextAuctionId;
    
    // 用户的出价记录 (auctionId => bidder => amount in USD)
    mapping(uint256 => mapping(address => uint256)) public bidRecords;
    
    // 平台费率 (1000 = 10%)
    uint256 public platformFeeRate;
    address public feeRecipient;
    
    // 最小拍卖时间
    uint256 public constant MIN_AUCTION_DURATION = 1 hours;
    uint256 public constant MAX_AUCTION_DURATION = 30 days;
    
    // 事件定义
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 reservePrice,
        uint256 duration
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        address indexed bidToken,
        uint256 bidAmount,
        uint256 usdValue
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice,
        address paymentToken
    );
    
    event PriceFeedUpdated(address indexed token, address indexed priceFeed);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev 初始化函数
     */
    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        nextAuctionId = 1;
        platformFeeRate = 250; // 2.5%
        feeRecipient = msg.sender;
    }
    
    /**
     * @dev 设置跨链桥接合约地址
     * @param _crossChainBridge 跨链桥合约地址
     */
    function setCrossChainBridge(address _crossChainBridge) external onlyOwner {
        crossChainBridge = _crossChainBridge;
    }
    
    /**
     * @dev 设置价格预言机
     * @param tokenAddress 代币地址 (address(0) 表示 ETH)
     * @param priceFeed 预言机合约地址
     */
    function setPriceFeed(address tokenAddress, address priceFeed) external onlyOwner {
        priceFeeds[tokenAddress] = AggregatorV3Interface(priceFeed);
        emit PriceFeedUpdated(tokenAddress, priceFeed);
    }
    
    /**
     * @dev 创建拍卖
     * @param duration 拍卖持续时间（秒）
     * @param startPrice 起始价格（美元，18位小数）
     * @param reservePrice 保留价格（美元，18位小数）
     * @param nftAddress NFT 合约地址
     * @param tokenId NFT Token ID
     */
    function createAuction(
        uint256 duration,
        uint256 startPrice,
        uint256 reservePrice,
        address nftAddress,
        uint256 tokenId
    ) external nonReentrant returns (uint256) {
        require(duration >= MIN_AUCTION_DURATION && duration <= MAX_AUCTION_DURATION, "Invalid duration");
        require(startPrice > 0, "Start price must be positive");
        require(reservePrice >= startPrice, "Reserve price too low");
        require(nftAddress != address(0), "Invalid NFT contract");
        
        IERC721 nft = IERC721(nftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner of NFT");
        require(nft.isApprovedForAll(msg.sender, address(this)) || 
                nft.getApproved(tokenId) == address(this), "NFT not approved");
        
        // 转移 NFT 到合约
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        
        uint256 auctionId = nextAuctionId++;
        
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
        return auctionId;
    }
    
    /**
     * @dev 使用 ETH 出价
     * @param auctionId 拍卖 ID
     */
    function placeBidWithETH(uint256 auctionId) external payable nonReentrant {
        require(msg.value > 0, "Bid must be positive");
        
        uint256 usdValue = getTokenPriceInUSD(address(0), msg.value);
        _placeBid(auctionId, address(0), msg.value, usdValue);
    }
    
    /**
     * @dev 使用 ERC20 代币出价
     * @param auctionId 拍卖 ID
     * @param tokenAddress 代币地址
     * @param amount 代币数量
     */
    function placeBidWithToken(
        uint256 auctionId,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(tokenAddress != address(0), "Use placeBidWithETH for ETH");
        require(address(priceFeeds[tokenAddress]) != address(0), "Token not supported");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");
        
        uint256 usdValue = getTokenPriceInUSD(tokenAddress, amount);
        
        // 转移代币到合约
        token.transferFrom(msg.sender, address(this), amount);
        
        _placeBid(auctionId, tokenAddress, amount, usdValue);
    }
    
    /**
     * @dev 内部出价逻辑
     */
    function _placeBid(
        uint256 auctionId,
        address tokenAddress,
        uint256 amount,
        uint256 usdValue
    ) internal virtual {
        Auction storage auction = auctions[auctionId];
        
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction ended");
        require(block.timestamp < auction.startTime + auction.duration, "Auction expired");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(usdValue >= auction.startPrice, "Bid below start price");
        require(usdValue > auction.highestBid, "Bid not high enough");
        
        // 退还之前最高出价者的资金
        if (auction.highestBidder != address(0)) {
            _refundBidder(auction.highestBidder, auction.bidToken, auction.originalBidAmount);
        }
        
        // 更新拍卖信息
        auction.highestBidder = msg.sender;
        auction.highestBid = usdValue;
        auction.bidToken = tokenAddress;
        auction.originalBidAmount = amount;
        
        // 记录用户出价
        bidRecords[auctionId][msg.sender] = usdValue;
        
        // 如果拍卖剩余时间少于15分钟，延长15分钟
        uint256 timeRemaining = (auction.startTime + auction.duration) - block.timestamp;
        if (timeRemaining < 15 minutes) {
            auction.duration += 15 minutes;
        }
        
        emit BidPlaced(auctionId, msg.sender, tokenAddress, amount, usdValue);
    }
    
    /**
     * @dev 结束拍卖
     * @param auctionId 拍卖 ID
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction already ended");
        require(
            block.timestamp >= auction.startTime + auction.duration ||
            msg.sender == auction.seller,
            "Auction not yet ended"
        );
        
        auction.ended = true;
        
        if (auction.highestBidder != address(0) && auction.highestBid >= auction.reservePrice) {
            // 拍卖成功
            _executeSuccessfulAuction(auctionId, auction);
        } else {
            // 拍卖失败，退还 NFT
            _executeFailedAuction(auctionId, auction);
        }
        
        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid, auction.bidToken);
    }
    
    /**
     * @dev 执行成功的拍卖
     */
    function _executeSuccessfulAuction(uint256 auctionId, Auction memory auction) internal {
        // 计算平台费用
        uint256 totalAmount = auction.originalBidAmount;
        uint256 platformFee = (totalAmount * platformFeeRate) / 10000;
        uint256 sellerAmount = totalAmount - platformFee;
        
        // 转移 NFT 给赢家
        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.highestBidder,
            auction.tokenId
        );
        
        // 支付卖家和平台费用
        if (auction.bidToken == address(0)) {
            // ETH 支付
            (bool success1, ) = payable(auction.seller).call{value: sellerAmount}("");
            require(success1, "Payment to seller failed");
            
            if (platformFee > 0) {
                (bool success2, ) = payable(feeRecipient).call{value: platformFee}("");
                require(success2, "Platform fee transfer failed");
            }
        } else {
            // ERC20 代币支付
            IERC20 token = IERC20(auction.bidToken);
            require(token.transfer(auction.seller, sellerAmount), "Payment to seller failed");
            
            if (platformFee > 0) {
                require(token.transfer(feeRecipient, platformFee), "Platform fee transfer failed");
            }
        }
    }
    
    /**
     * @dev 执行失败的拍卖
     */
    function _executeFailedAuction(uint256 auctionId, Auction memory auction) internal {
        // 退还 NFT 给卖家
        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );
        
        // 退还最高出价者的资金
        if (auction.highestBidder != address(0)) {
            _refundBidder(auction.highestBidder, auction.bidToken, auction.originalBidAmount);
        }
    }
    
    /**
     * @dev 退还出价者资金
     */
    function _refundBidder(address bidder, address tokenAddress, uint256 amount) internal {
        if (tokenAddress == address(0)) {
            // 退还 ETH
            (bool success, ) = payable(bidder).call{value: amount}("");
            require(success, "ETH refund failed");
        } else {
            // 退还 ERC20 代币
            IERC20 token = IERC20(tokenAddress);
            require(token.transfer(bidder, amount), "Token refund failed");
        }
    }
    
    /**
     * @dev 获取代币的美元价格
     * @param tokenAddress 代币地址 (address(0) 表示 ETH)
     * @param amount 代币数量
     * @return 美元价值 (18位小数)
     */
    function getTokenPriceInUSD(address tokenAddress, uint256 amount) public view returns (uint256) {
        AggregatorV3Interface priceFeed = priceFeeds[tokenAddress];
        require(address(priceFeed) != address(0), "Price feed not set");
        
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        
        uint8 decimals = priceFeed.decimals();
        
        // 将价格转换为 18 位小数，然后乘以数量
        uint256 priceInUSD = (uint256(price) * (10 ** 18)) / (10 ** decimals);
        return (priceInUSD * amount) / (10 ** 18);
    }
    
    /**
     * @dev 获取拍卖信息
     * @param auctionId 拍卖 ID
     */
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }
    
    /**
     * @dev 检查拍卖是否活跃
     * @param auctionId 拍卖 ID
     */
    function isAuctionActive(uint256 auctionId) external view returns (bool) {
        Auction memory auction = auctions[auctionId];
        return !auction.ended && 
               block.timestamp < auction.startTime + auction.duration &&
               auction.seller != address(0);
    }
    
    /**
     * @dev 获取剩余时间
     * @param auctionId 拍卖 ID
     */
    function getTimeRemaining(uint256 auctionId) external view returns (uint256) {
        Auction memory auction = auctions[auctionId];
        if (auction.ended || block.timestamp >= auction.startTime + auction.duration) {
            return 0;
        }
        return (auction.startTime + auction.duration) - block.timestamp;
    }
    
    /**
     * @dev 获取用户在指定拍卖中的出价记录
     * @param auctionId 拍卖 ID
     * @param bidder 出价者地址
     */
    function getUserBidAmount(uint256 auctionId, address bidder) external view returns (uint256) {
        return bidRecords[auctionId][bidder];
    }
    
    /**
     * @dev 设置平台费率
     * @param newFeeRate 新费率 (1000 = 10%)
     */
    function setPlatformFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 1000, "Fee rate too high"); // 最大 10%
        platformFeeRate = newFeeRate;
    }
    
    /**
     * @dev 设置费用接收者
     * @param newFeeRecipient 新的费用接收者地址
     */
    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid address");
        feeRecipient = newFeeRecipient;
    }
    
    /**
     * @dev 紧急情况下取消拍卖（仅所有者）
     * @param auctionId 拍卖 ID
     */
    function emergencyCancelAuction(uint256 auctionId) external onlyOwner {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(!auction.ended, "Auction already ended");
        
        auction.ended = true;
        
        // 退还 NFT
        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );
        
        // 退还最高出价者资金
        if (auction.highestBidder != address(0)) {
            _refundBidder(auction.highestBidder, auction.bidToken, auction.originalBidAmount);
        }
    }
    
    // ERC721 接收器
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    // 升级授权
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}