pragma solidity ^0.4.24;

import '../../contracts/KeysManager.sol';


contract KeysManagerMock is KeysManager {
    function setProxyStorage(address _proxyStorage) public {
        addressStorage[keccak256("proxyStorage")] = _proxyStorage;
    }

    function setInitEnabled() public {
    	boolStorage[INIT_DISABLED] = false;
    }
}