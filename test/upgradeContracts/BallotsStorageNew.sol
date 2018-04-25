pragma solidity ^0.4.18;

import "../../contracts/BallotsStorage.sol";


contract BallotsStorageNew is BallotsStorage {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}