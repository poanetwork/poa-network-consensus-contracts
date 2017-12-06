pragma solidity ^0.4.18;

import '../../contracts/KeysManager.sol';

contract KeysManagerMock is KeysManager {
  function KeysManagerMock(address _proxyStorage, address _poaConsensus, address _masterOfCeremony)
   KeysManager(_proxyStorage, _poaConsensus, _masterOfCeremony) 
  {
  }
  function setMasterOfCeremony(address _newAddress) {
    masterOfCeremony = _newAddress;
  }

  function setMaxNumberOfInitialKeys(uint256 _newMax) {
    maxNumberOfInitialKeys = _newMax;
  }

  function setPoaConsensus(address _poaConsensus) public {
    poaNetworkConsensus = IPoaNetworkConsensus(_poaConsensus);
  }

  function setProxyStorage(address _proxyStorage) public {
    proxyStorage = IProxyStorage(_proxyStorage);
  }
}