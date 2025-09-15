// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract Voting {
    address[] public votingList ;

    mapping(address => uint256) private _votesReceived; // 候选人地址 => 得票数

    function vote(address candidate ) public {
        if (_votesReceived[candidate] == 0) {
            votingList.push(candidate);
        }
        _votesReceived[candidate] += 1;
    }

    function getVote(address candidate) public view returns (uint256) {
        return  _votesReceived[candidate];
        
    }

    function resetVotes() public {
         for (uint256 i = 0; i < votingList.length; i++) {
            _votesReceived[votingList[i]] = 0;
        }
    }

    }
