pragma solidity ^0.4.18;

import '../mockContracts/VotingToChangeKeysMock.sol';

contract VotingToChangeKeysNew is VotingToChangeKeysMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}