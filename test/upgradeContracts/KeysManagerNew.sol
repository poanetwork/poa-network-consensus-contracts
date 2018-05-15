pragma solidity ^0.4.23;

import '../mockContracts/KeysManagerMock.sol';

contract KeysManagerNew is KeysManagerMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}