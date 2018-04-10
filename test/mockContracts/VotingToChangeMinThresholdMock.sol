pragma solidity ^0.4.18;

import '../../contracts/VotingToChangeMinThreshold.sol';
import '../../contracts/KeysManager.sol';
import '../../contracts/BallotsStorage.sol';

contract VotingToChangeMinThresholdMock is VotingToChangeMinThreshold {
  uint256 public time;
  function VotingToChangeMinThresholdMock(address _proxyStorage)
    VotingToChangeMinThreshold(_proxyStorage, false)
  {
  }

  function setTime(uint256 _newTime) public {
    time = _newTime;
  }

  function getTime() public view returns(uint256) {
    if(time == 0) {
      return now;
    } else {
      return time;
    }
  }
}