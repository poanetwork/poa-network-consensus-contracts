pragma solidity ^0.4.23;

import '../../contracts/KeysManager.sol';


contract KeysManagerMock is KeysManager {
    function setMasterOfCeremony(address _newAddress) public {
        addressStorage[keccak256("masterOfCeremony")] = _newAddress;
    }

    function setMaxNumberOfInitialKeys(uint256 _newMax) public {
        uintStorage[keccak256("maxNumberOfInitialKeys")] = _newMax;
    }

    function setPoaConsensus(address _poaConsensus) public {
        addressStorage[keccak256("poaNetworkConsensus")] = _poaConsensus;
    }

    function setProxyStorage(address _proxyStorage) public {
        addressStorage[keccak256("proxyStorage")] = _proxyStorage;
    }
}