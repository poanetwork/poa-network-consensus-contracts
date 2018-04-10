pragma solidity ^0.4.18;

import '../../contracts/BallotsStorage.sol';

contract BallotsStorageMock is BallotsStorage {
  function BallotsStorageMock(address _proxyStorage) BallotsStorage(_proxyStorage, false) {
  }
}