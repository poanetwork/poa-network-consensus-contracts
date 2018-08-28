pragma solidity ^0.4.24;

import '../../contracts/KeysManager.sol';


contract KeysManagerMock is KeysManager {
    function getInitialKey(address _initialKey) public view returns(uint8) {
        return uint8(getInitialKeyStatus(_initialKey));
    }

    function setProxyStorage(address _proxyStorage) public {
        addressStorage[PROXY_STORAGE] = _proxyStorage;
    }

    function setInitEnabled() public {
        boolStorage[INIT_DISABLED] = false;
    }
}