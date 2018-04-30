pragma solidity ^0.4.18;

import "./EternalStorage.sol";
import "./IEternalStorageProxy.sol";


/**
 * @title EternalStorageProxy
 * @dev This proxy holds the storage of the token contract and delegates every call to the current implementation set.
 * Besides, it allows to upgrade the token's behaviour towards further implementations, and provides
 * authorization control functionalities
 */
contract EternalStorageProxy is EternalStorage, IEternalStorageProxy {

    /**
    * @dev This event will be emitted every time the implementation gets upgraded
    * @param version representing the version number of the upgraded implementation
    * @param implementation representing the address of the upgraded implementation
    */
    event Upgraded(uint256 version, address indexed implementation);

    modifier onlyProxyStorage() {
        require(msg.sender == addressStorage[keccak256("proxyStorage")]);
        _;
    }

    function EternalStorageProxy(address _proxyStorage, address _implementationAddress) public {
        //require(_proxyStorage != address(0));
        require(_implementationAddress != address(0));

        if (_proxyStorage != address(0)) {
            addressStorage[keccak256("proxyStorage")] = _proxyStorage;
        } else {
            addressStorage[keccak256("proxyStorage")] = address(this);
        }
        
        _implementation = _implementationAddress;
        addressStorage[keccak256("owner")] = msg.sender;
    }

    /**
    * @dev Fallback function allowing to perform a delegatecall to the given implementation.
    * This function will return whatever the implementation call returns
    */
    function () public payable {
        address _impl = _implementation;
        require(_impl != address(0));

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize)
            let result := delegatecall(gas, _impl, ptr, calldatasize, 0, 0)
            let size := returndatasize
            returndatacopy(ptr, 0, size)

            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }

    /**
     * @dev Allows ProxyStorage contract to upgrade the current implementation.
     * @param implementation representing the address of the new implementation to be set.
     */
    function upgradeTo(address implementation) public onlyProxyStorage {
        require(_implementation != implementation);
        require(implementation != address(0));

        uint256 _newVersion = _version + 1;
        assert(_newVersion > _version);
        _version = _newVersion;

        _implementation = implementation;
        Upgraded(_version, _implementation);
    }

}
