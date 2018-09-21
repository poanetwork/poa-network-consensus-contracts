pragma solidity ^0.4.24;

import '../mockContracts/BallotsStorageMock.sol';


contract BallotsStorageNew is BallotsStorageMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}