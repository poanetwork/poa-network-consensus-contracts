pragma solidity ^0.4.18;

import '../../contracts/VotingToChangeMinThreshold.sol';
import '../../contracts/KeysManager.sol';
import '../../contracts/BallotsStorage.sol';

contract VotingToChangeMinThresholdMock is VotingToChangeMinThreshold {
  uint256 public time;
  function VotingToChangeMinThresholdMock(address _keysContract, address _ballotsStorage)
    VotingToChangeMinThreshold(_keysContract, _ballotsStorage)
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

  function setKeysManager(address _newAddress) public {
    keysManager = KeysManager(_newAddress);
  }


}