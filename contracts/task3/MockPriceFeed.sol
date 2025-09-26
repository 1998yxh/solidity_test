// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockPriceFeed
 * @dev 模拟 Chainlink 价格预言机，用于测试
 */
contract MockPriceFeed is AggregatorV3Interface {
    uint8 public override decimals;
    string public override description;
    uint256 public override version;
    
    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }
    
    RoundData public latestRoundData_;
    mapping(uint80 => RoundData) public rounds;
    
    constructor(
        uint8 _decimals,
        string memory _description,
        uint256 _version,
        int256 _initialPrice
    ) {
        decimals = _decimals;
        description = _description;
        version = _version;
        
        latestRoundData_ = RoundData({
            roundId: 1,
            answer: _initialPrice,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            answeredInRound: 1
        });
        
        rounds[1] = latestRoundData_;
    }
    
    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        RoundData memory round = rounds[_roundId];
        return (
            round.roundId,
            round.answer,
            round.startedAt,
            round.updatedAt,
            round.answeredInRound
        );
    }
    
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            latestRoundData_.roundId,
            latestRoundData_.answer,
            latestRoundData_.startedAt,
            latestRoundData_.updatedAt,
            latestRoundData_.answeredInRound
        );
    }
    
    // 管理员函数，用于更新价格
    function updatePrice(int256 _price) external {
        latestRoundData_.roundId += 1;
        latestRoundData_.answer = _price;
        latestRoundData_.startedAt = block.timestamp;
        latestRoundData_.updatedAt = block.timestamp;
        latestRoundData_.answeredInRound = latestRoundData_.roundId;
        
        rounds[latestRoundData_.roundId] = latestRoundData_;
    }
}

/**
 * @title PriceFeedRegistry
 * @dev 价格预言机注册表，用于管理多个价格预言机
 */
contract PriceFeedRegistry {
    mapping(address => address) public priceFeeds;
    address[] public supportedTokens;
    
    event PriceFeedAdded(address indexed token, address indexed priceFeed);
    event PriceFeedUpdated(address indexed token, address indexed oldPriceFeed, address indexed newPriceFeed);
    
    /**
     * @dev 添加或更新价格预言机
     */
    function setPriceFeed(address token, address priceFeed) external {
        require(priceFeed != address(0), "Invalid price feed address");
        
        address oldPriceFeed = priceFeeds[token];
        priceFeeds[token] = priceFeed;
        
        if (oldPriceFeed == address(0)) {
            supportedTokens.push(token);
            emit PriceFeedAdded(token, priceFeed);
        } else {
            emit PriceFeedUpdated(token, oldPriceFeed, priceFeed);
        }
    }
    
    /**
     * @dev 获取代币价格
     */
    function getPrice(address token) external view returns (int256) {
        address priceFeed = priceFeeds[token];
        require(priceFeed != address(0), "Price feed not found");
        
        (, int256 price, , , ) = AggregatorV3Interface(priceFeed).latestRoundData();
        return price;
    }
    
    /**
     * @dev 获取所有支持的代币
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev 检查代币是否支持
     */
    function isTokenSupported(address token) external view returns (bool) {
        return priceFeeds[token] != address(0);
    }
}