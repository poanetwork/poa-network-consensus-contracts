pragma solidity ^0.4.23;

import '../../contracts/KeysManager.sol';


contract KeysManagerMock is KeysManager {
    function setProxyStorage(address _proxyStorage) public {
        addressStorage[keccak256("proxyStorage")] = _proxyStorage;
    }
}