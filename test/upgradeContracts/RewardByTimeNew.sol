pragma solidity ^0.4.24;

import '../mockContracts/RewardByTimeMock.sol';


contract RewardByTimeNew is RewardByTimeMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}