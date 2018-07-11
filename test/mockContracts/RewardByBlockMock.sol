pragma solidity ^0.4.24;

import '../../contracts/RewardByBlock.sol';


contract RewardByBlockMock is RewardByBlock {
    address internal systemAddress;

    modifier onlySystem {
        require(msg.sender == systemAddress);
        _;
    }

    function setSystemAddress(address _address) public {
        systemAddress = _address;
    }
}