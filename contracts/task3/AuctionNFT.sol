// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuctionNFT
 * @dev NFT 合约，支持铸造和转移，用于拍卖市场
 */
contract AuctionNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    string private _baseTokenURI;
    
    // 铸造费用
    uint256 public mintPrice = 0.01 ether;
    
    // 最大供应量
    uint256 public maxSupply = 10000;
    
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseTokenURI
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI;
        mintPrice = 0.01 ether;
        maxSupply = 10000;
    }
    
    /**
     * @dev 铸造新的 NFT
     * @param to 接收者地址
     * @param uri NFT 元数据 URI
     */
    function mintNFT(address to, string memory uri) external payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_tokenIdCounter < maxSupply, "Max supply reached");
        
        uint256 tokenId = ++_tokenIdCounter;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
        return tokenId;
    }
    
    /**
     * @dev 批量铸造 NFT
     * @param to 接收者地址
     * @param tokenURIs NFT 元数据 URI 数组
     */
    function batchMint(address to, string[] memory tokenURIs) external payable {
        require(msg.value >= mintPrice * tokenURIs.length, "Insufficient payment");
        require(_tokenIdCounter + tokenURIs.length <= maxSupply, "Exceeds max supply");
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            uint256 tokenId = ++_tokenIdCounter;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            emit NFTMinted(to, tokenId, tokenURIs[i]);
        }
    }
    
    /**
     * @dev 管理员铸造 (免费)
     * @param to 接收者地址
     * @param uri NFT 元数据 URI
     */
    function mint(address to, string memory uri) external onlyOwner returns (uint256) {
        require(_tokenIdCounter < maxSupply, "Max supply reached");
        
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
        return tokenId;
    }
    
    /**
     * @dev 获取下一个可用的 Token ID
     */
    function getNextTokenId() external view returns (uint256) {
        return _tokenIdCounter + 1;
    }
    
    /**
     * @dev 获取用户拥有的所有 NFT ID
     * @param owner 用户地址
     */
    function getTokensByOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }
    
    /**
     * @dev 设置铸造价格
     * @param newPrice 新的铸造价格
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }
    
    /**
     * @dev 设置最大供应量
     * @param newMaxSupply 新的最大供应量
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= _tokenIdCounter, "Cannot reduce below current supply");
        maxSupply = newMaxSupply;
    }
    
    /**
     * @dev 提取合约余额
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // 重写必需的函数
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}