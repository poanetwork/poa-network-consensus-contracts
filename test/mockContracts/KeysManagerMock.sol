pragma solidity ^0.4.18;

import '../../contracts/KeysManager.sol';

contract KeysManagerMock is KeysManager {
  function KeysManagerMock(address _masterOfCeremony) {
    if(_masterOfCeremony != address(0)){
      owner = _masterOfCeremony;
    } else {
      owner = masterOfCeremony;
    }
  }
  function setMasterOfCeremony(address _newAddress) {
    masterOfCeremony = _newAddress;
  }
  
  function setMaxNumberOfInitialKeys(uint256 _newMax) {
    maxNumberOfInitialKeys = _newMax;
  }
}