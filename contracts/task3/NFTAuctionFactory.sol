// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./NFTAuctionPlatform.sol";

/**
 * @title NFTAuctionFactory
 * @dev 拍卖工厂合约，用于创建和管理多个拍卖平台实例
 * 参考 Uniswap V2 Factory 模式
 */
contract NFTAuctionFactory is Ownable {
    // 拍卖平台实现合约地址
    address public immutable auctionImplementation;
    
    // 所有创建的拍卖平台
    address[] public allAuctions;
    
    // 创建者 => 拍卖平台地址数组
    mapping(address => address[]) public userAuctions;
    
    // 拍卖平台地址 => 创建者
    mapping(address => address) public auctionCreator;
    
    // 是否为工厂创建的拍卖平台
    mapping(address => bool) public isAuctionPlatform;
    
    // 默认价格预言机配置
    struct PriceFeedConfig {
        address token;
        address priceFeed;
    }
    
    PriceFeedConfig[] public defaultPriceFeeds;
    
    // 事件
    event AuctionPlatformCreated(
        address indexed creator,
        address indexed auctionPlatform,
        uint256 platformIndex
    );
    
    event DefaultPriceFeedAdded(address indexed token, address indexed priceFeed);
    event DefaultPriceFeedRemoved(address indexed token);
    
    /**
     * @dev 构造函数
     */
    constructor() Ownable(msg.sender) {
        // 部署拍卖平台实现合约
        auctionImplementation = address(new NFTAuctionPlatform());
    }
    
    /**
     * @dev 创建新的拍卖平台
     * @return auctionPlatform 新创建的拍卖平台地址
     */
    function createAuctionPlatform() external returns (address auctionPlatform) {
        // 创建代理合约
        bytes memory initData = abi.encodeWithSelector(
            NFTAuctionPlatform.initialize.selector
        );
        
        auctionPlatform = address(new ERC1967Proxy(auctionImplementation, initData));
        
        // 设置默认价格预言机（在转移所有权之前）
        _setDefaultPriceFeeds(auctionPlatform);
        
        // 转移所有权给调用者
        NFTAuctionPlatform(auctionPlatform).transferOwnership(msg.sender);
        
        // 记录信息
        allAuctions.push(auctionPlatform);
        userAuctions[msg.sender].push(auctionPlatform);
        auctionCreator[auctionPlatform] = msg.sender;
        isAuctionPlatform[auctionPlatform] = true;
        
        emit AuctionPlatformCreated(msg.sender, auctionPlatform, allAuctions.length - 1);
        
        return auctionPlatform;
    }
    
    /**
     * @dev 为新创建的拍卖平台设置默认价格预言机
     * @param auctionPlatform 拍卖平台地址
     */
    function _setDefaultPriceFeeds(address auctionPlatform) internal {
        NFTAuctionPlatform platform = NFTAuctionPlatform(auctionPlatform);
        
        for (uint256 i = 0; i < defaultPriceFeeds.length; i++) {
            platform.setPriceFeed(
                defaultPriceFeeds[i].token,
                defaultPriceFeeds[i].priceFeed
            );
        }
    }
    
    /**
     * @dev 添加默认价格预言机配置
     * @param token 代币地址 (address(0) 表示 ETH)
     * @param priceFeed 价格预言机地址
     */
    function addDefaultPriceFeed(address token, address priceFeed) external onlyOwner {
        require(priceFeed != address(0), "Invalid price feed");
        
        // 检查是否已存在
        for (uint256 i = 0; i < defaultPriceFeeds.length; i++) {
            if (defaultPriceFeeds[i].token == token) {
                defaultPriceFeeds[i].priceFeed = priceFeed;
                emit DefaultPriceFeedAdded(token, priceFeed);
                return;
            }
        }
        
        // 添加新的配置
        defaultPriceFeeds.push(PriceFeedConfig({
            token: token,
            priceFeed: priceFeed
        }));
        
        emit DefaultPriceFeedAdded(token, priceFeed);
    }
    
    /**
     * @dev 移除默认价格预言机配置
     * @param token 代币地址
     */
    function removeDefaultPriceFeed(address token) external onlyOwner {
        for (uint256 i = 0; i < defaultPriceFeeds.length; i++) {
            if (defaultPriceFeeds[i].token == token) {
                // 移动最后一个元素到当前位置
                defaultPriceFeeds[i] = defaultPriceFeeds[defaultPriceFeeds.length - 1];
                defaultPriceFeeds.pop();
                emit DefaultPriceFeedRemoved(token);
                return;
            }
        }
        revert("Price feed not found");
    }
    
    /**
     * @dev 批量为现有拍卖平台更新价格预言机
     * @param token 代币地址
     * @param priceFeed 价格预言机地址
     * @param platforms 要更新的拍卖平台地址数组
     */
    function batchUpdatePriceFeed(
        address token,
        address priceFeed,
        address[] calldata platforms
    ) external onlyOwner {
        require(priceFeed != address(0), "Invalid price feed");
        
        for (uint256 i = 0; i < platforms.length; i++) {
            require(isAuctionPlatform[platforms[i]], "Not a valid auction platform");
            
            try NFTAuctionPlatform(platforms[i]).setPriceFeed(token, priceFeed) {
                // 成功更新
            } catch {
                // 忽略失败的更新（可能是权限问题）
            }
        }
    }
    
    /**
     * @dev 获取所有拍卖平台数量
     */
    function allAuctionsLength() external view returns (uint256) {
        return allAuctions.length;
    }
    
    /**
     * @dev 获取用户创建的拍卖平台数量
     * @param user 用户地址
     */
    function userAuctionsLength(address user) external view returns (uint256) {
        return userAuctions[user].length;
    }
    
    /**
     * @dev 获取用户创建的所有拍卖平台
     * @param user 用户地址
     */
    function getUserAuctions(address user) external view returns (address[] memory) {
        return userAuctions[user];
    }
    
    /**
     * @dev 获取指定范围的拍卖平台
     * @param start 起始索引
     * @param end 结束索引（不包含）
     */
    function getAuctionsPaginated(uint256 start, uint256 end) 
        external 
        view 
        returns (address[] memory) 
    {
        require(start < end && end <= allAuctions.length, "Invalid range");
        
        address[] memory result = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = allAuctions[i];
        }
        return result;
    }
    
    /**
     * @dev 获取所有默认价格预言机配置
     */
    function getAllDefaultPriceFeeds() external view returns (PriceFeedConfig[] memory) {
        return defaultPriceFeeds;
    }
    
    /**
     * @dev 获取默认价格预言机配置数量
     */
    function defaultPriceFeedsLength() external view returns (uint256) {
        return defaultPriceFeeds.length;
    }
    
    /**
     * @dev 检查地址是否为有效的拍卖平台
     * @param platform 要检查的地址
     */
    function isValidAuctionPlatform(address platform) external view returns (bool) {
        return isAuctionPlatform[platform];
    }
    
    /**
     * @dev 获取拍卖平台的创建者
     * @param platform 拍卖平台地址
     */
    function getAuctionCreator(address platform) external view returns (address) {
        require(isAuctionPlatform[platform], "Not a valid auction platform");
        return auctionCreator[platform];
    }
    
    /**
     * @dev 升级所有拍卖平台的实现合约（如果有权限）
     * @param newImplementation 新的实现合约地址
     * @param platforms 要升级的平台列表
     */
    function batchUpgradeAuctionPlatforms(
        address newImplementation,
        address[] calldata platforms
    ) external onlyOwner {
        require(newImplementation != address(0), "Invalid implementation");
        
        for (uint256 i = 0; i < platforms.length; i++) {
            require(isAuctionPlatform[platforms[i]], "Not a valid auction platform");
            
            try NFTAuctionPlatform(platforms[i]).upgradeToAndCall(
                newImplementation,
                ""
            ) {
                // 成功升级
            } catch {
                // 忽略失败的升级（可能是权限问题）
            }
        }
    }
    
    /**
     * @dev 紧急暂停指定的拍卖平台（如果有权限）
     * @param platforms 要暂停的平台列表
     */
    function emergencyPauseAuctionPlatforms(address[] calldata platforms) external onlyOwner {
        for (uint256 i = 0; i < platforms.length; i++) {
            require(isAuctionPlatform[platforms[i]], "Not a valid auction platform");
            
            // 这里可以添加暂停逻辑，比如调用平台的暂停函数
            // 注意：这需要拍卖平台合约支持暂停功能
        }
    }
}