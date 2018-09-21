pragma solidity ^0.4.24;

import '../mockContracts/VotingToChangeMinThresholdMock.sol';

contract VotingToChangeMinThresholdNew is VotingToChangeMinThresholdMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}