pragma solidity ^0.4.23;

import '../mockContracts/VotingToChangeProxyAddressMock.sol';

contract VotingToChangeProxyAddressNew is VotingToChangeProxyAddressMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}