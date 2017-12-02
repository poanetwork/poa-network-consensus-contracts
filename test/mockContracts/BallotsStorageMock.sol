pragma solidity ^0.4.18;

import '../../contracts/BallotsStorage.sol';

contract BallotsStorageMock is BallotsStorage {
  function BallotsStorageMock(address _votingToChangeThreshold) BallotsStorage(_votingToChangeThreshold) {
  }
  
  function setVotingToChangeThresholdMock(address _votingToChangeThreshold) public {
    votingToChangeThreshold = _votingToChangeThreshold;
  }
}