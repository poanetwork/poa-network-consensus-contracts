pragma solidity ^0.4.18;
import "./IVoting.sol";

contract VotingKeys is IVoting { 
  uint256 public affectedKeyType;
  address public affectedKey;
  address public miningKey;
  function VotingKeys(
    uint256 _startTime,
    uint256 _endTime,
    address _keysContract,
    address _affectedKey,
    uint256 _affectedKeyType,
    address _miningKey) IVoting(_startTime, _endTime, _keysContract) 
  {
    require(_affectedKey != address(0));
    require(_affectedKeyType != 0);
    affectedKey = _affectedKey;
    affectedKeyType = _affectedKeyType;
    miningKey = _miningKey;
  }

  function finalizeBallot() private {
    ballotsManager.finalizeKeys(address(this), progress, totalVoters, affectedKey, affectedKeyType, miningKey);
  }
}