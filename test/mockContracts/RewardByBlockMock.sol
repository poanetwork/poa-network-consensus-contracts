pragma solidity ^0.4.24;

import '../../contracts/RewardByBlock.sol';


contract RewardByBlockMock is RewardByBlock {
    modifier onlyBridgeContract {
        require(msg.sender == addressStorage[keccak256("bridgeContractAddress")]);
        _;
    }

    modifier onlySystem {
        require(msg.sender == addressStorage[keccak256("systemAddress")]);
        _;
    }

    function setBridgeContractAddress(address _address) public {
        addressStorage[keccak256("bridgeContractAddress")] = _address;
    }

    function setSystemAddress(address _address) public {
        addressStorage[keccak256("systemAddress")] = _address;
    }
}