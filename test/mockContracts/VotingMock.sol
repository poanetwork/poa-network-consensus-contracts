pragma solidity ^0.4.18;

import '../../contracts/voting/VotingKeys.sol';

contract VotingMock is VotingKeys {
  uint256 public time;
  function VotingMock(uint256 _startTime, uint256 _endTime, address _keysContract, address _affectedKey, uint256 _affectedKeyType, address _miningKey)
    VotingKeys(_startTime, _endTime, _keysContract, _affectedKey, _affectedKeyType, _miningKey)
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