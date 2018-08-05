pragma solidity ^0.4.24;

import '../../contracts/eternal-storage/EternalStorageProxy.sol';


contract EternalStorageProxyMock is EternalStorageProxy {
    constructor(
        address _proxyStorage,
        address _implementationAddress
    ) EternalStorageProxy(
        _proxyStorage,
        _implementationAddress
    ) public {
    }

    function setProxyStorage(address _proxyStorage) public {
        addressStorage[PROXY_STORAGE] = _proxyStorage;
    }
}
