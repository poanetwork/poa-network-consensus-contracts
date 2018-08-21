pragma solidity ^0.4.24;

import '../../contracts/VotingToChangeKeys.sol';

contract VotingToChangeKeysNew is VotingToChangeKeys {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}