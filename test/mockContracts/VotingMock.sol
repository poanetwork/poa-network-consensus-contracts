pragma solidity ^0.4.18;

import '../../contracts/voting/VotingContract.sol';
import '../../contracts/KeysManager.sol';

contract VotingMock is VotingContract {
  uint256 public time;
  function VotingMock(address _keysContract)
    VotingContract(_keysContract)
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