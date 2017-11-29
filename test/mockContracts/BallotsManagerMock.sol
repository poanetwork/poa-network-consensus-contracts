pragma solidity ^0.4.18;

import '../../contracts/BallotsManager.sol';

contract BallotsManagerMock is BallotsManager {
  function BallotsManagerMock(address _poaConsensus)
    BallotsManager(_poaConsensus)
  {}
  function setKeysManager(address _newAddress) {
    keysManager = KeysManager(_newAddress);
  }
}