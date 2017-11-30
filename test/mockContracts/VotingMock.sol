pragma solidity ^0.4.18;

import '../../contracts/voting/Voting.sol';

contract VotingMock is Voting {
  uint256 public time;
  function VotingMock(uint256 _startTime, uint256 _endTime, address _keysContract)
    Voting(_startTime, _endTime, _keysContract)
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