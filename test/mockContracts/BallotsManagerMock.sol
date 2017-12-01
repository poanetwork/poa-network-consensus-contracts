pragma solidity ^0.4.18;

import '../../contracts/BallotsManager.sol';
import './BallotsStorageMock.sol';
import './VotingMock.sol';

contract BallotsManagerMock is BallotsManager {
  //   struct Ballot {
  //   bool isActive;
  //   address affectedKey;
  //   uint256 affectedKeyType;
  //   address miningKey;
  //   uint256 ballotType;
  // }
  function BallotsManagerMock(address _keysManager, address _ballotsStorage)
    BallotsManager(_keysManager, _ballotsStorage)
  {

  }
  function setKeysManager(address _newAddress) {
    keysManager = KeysManager(_newAddress);
  }

  function setBallotsStorage(address _newAddress) {
    ballotsStorage = BallotsStorageMock(_newAddress);
  }

  function deployVotingContract(uint256 _startTime, uint256 _endTime, address _affectedKey, uint256 _affectedKeyType, address _miningKey) private returns(address) {
    return new VotingMock(_startTime, _endTime, address(keysManager), _affectedKey, _affectedKeyType, _miningKey);
  }
}