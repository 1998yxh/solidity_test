// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage,Ownable {
    uint256 private _tokenIdCounter;

      constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(msg.sender)  
    {}

    /**
     * @dev 重写 tokenURI 函数以支持 ERC721URIStorage
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev 重写 supportsInterface 函数以支持多重继承
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function mintNFT(address to, string memory tokenURI_) public onlyOwner returns (uint256){
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        _tokenIdCounter++;
        return tokenId;
    }

}