pragma solidity ^0.4.24;

import '../../contracts/RewardByBlock.sol';


contract RewardByBlockMock is RewardByBlock {
    address internal bridgeContractAddress;
    address internal systemAddress;

    modifier onlyBridgeContract {
        require(msg.sender == bridgeContractAddress);
        _;
    }

    modifier onlySystem {
        require(msg.sender == systemAddress);
        _;
    }

    function setBridgeContractAddress(address _address) public {
        bridgeContractAddress = _address;
    }

    function setSystemAddress(address _address) public {
        systemAddress = _address;
    }
}