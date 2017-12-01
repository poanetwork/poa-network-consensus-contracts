pragma solidity ^0.4.18;
import "./IVoting.sol";

contract VotingChangeMinThreshold is IVoting { 
  uint256 public proposedValue;
  function VotingChangeMinThreshold(
    uint256 _startTime,
    uint256 _endTime,
    address _keysContract,
    uint256 _proposedValue
    ) IVoting(_startTime, _endTime, _keysContract) 
  {
    proposedValue = _proposedValue;
  }

  function finalizeBallot() private {
    
  }
}