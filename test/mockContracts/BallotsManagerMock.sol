pragma solidity ^0.4.18;

import '../../contracts/BallotsManager.sol';
import './VotingMock.sol';

contract BallotsManagerMock is BallotsManager {
  //   struct Ballot {
  //   bool isActive;
  //   address affectedKey;
  //   uint256 affectedKeyType;
  //   address miningKey;
  //   uint256 ballotType;
  // }
  function BallotsManagerMock(address _poaConsensus)
    BallotsManager(_poaConsensus)
  {

  }
  function setKeysManager(address _newAddress) {
    keysManager = KeysManager(_newAddress);
  }

  function deployVotingContract(uint256 _startTime, uint256  _endTime) private returns(address) {
    return new VotingMock(_startTime, _endTime, address(keysManager));
  }
}