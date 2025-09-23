// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./NftAuction.sol";

contract NftAuctionV2 is NftAuction {
    function testHello() public pure returns (string memory) {
        return "Hello, World!";
    }
}