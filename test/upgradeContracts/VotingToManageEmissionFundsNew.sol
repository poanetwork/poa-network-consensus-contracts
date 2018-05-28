pragma solidity ^0.4.23;

import '../mockContracts/VotingToManageEmissionFundsMock.sol';

contract VotingToManageEmissionFundsNew is VotingToManageEmissionFundsMock {
  
  function initialize() public {
    boolStorage[keccak256('initialized')] = true;
  }

  function initialized() public view returns (bool) {
    return boolStorage[keccak256('initialized')];
  }

}