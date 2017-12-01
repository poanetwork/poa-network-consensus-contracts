pragma solidity ^0.4.18;

import '../../contracts/BallotsStorage.sol';

contract BallotsStorageMock is BallotsStorage {
  function BallotsStorageMock(address _ballotsManager)
    BallotsStorage(_ballotsManager)
  {

  }
  function setBallotsManager(address _newAddress) {
    ballotsManager = _newAddress;
  }
}