pragma solidity ^0.4.18;

import '../../contracts/eternal-storage/EternalStorageProxy.sol';


contract EternalStorageProxyMock is EternalStorageProxy {
    function EternalStorageProxyMock(
        address _proxyStorage,
        address _implementationAddress
    ) EternalStorageProxy(
        _proxyStorage,
        _implementationAddress
    ) public {
    }

    function setProxyStorage(address _proxyStorage) public {
        addressStorage[keccak256("proxyStorage")] = _proxyStorage;
    }

    function getProxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }
}
