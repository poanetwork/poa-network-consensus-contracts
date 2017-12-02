pragma solidity ^0.4.18;

contract BallotsStorage {
  address public votingToChangeThreshold;
  uint256 public minThresholdOfVoters = 3;

  modifier onlyVotingToChangeThreshold() {
    require(msg.sender == votingToChangeThreshold);
    _;
  }
  function BallotsStorage(address _votingToChangeThreshold) public {
    votingToChangeThreshold = _votingToChangeThreshold;
  }

  function setMinThresholdOfVoters(uint256 _newValue) public onlyVotingToChangeThreshold {
    require(_newValue > 0 && _newValue != minThresholdOfVoters);
    minThresholdOfVoters = _newValue;
  }
}