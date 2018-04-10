pragma solidity ^0.4.18;

import '../../contracts/VotingToChangeProxyAddress.sol';
import '../../contracts/KeysManager.sol';
import '../../contracts/BallotsStorage.sol';

contract VotingToChangeProxyAddressMock is VotingToChangeProxyAddress {
  uint256 public time;
  function VotingToChangeProxyAddressMock(address _proxyStorage)
    VotingToChangeProxyAddress(_proxyStorage, false)
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