pragma solidity ^0.4.24;

import "./EternalStorage.sol";


/**
 * @title EternalStorageProxy
 * @dev This proxy holds the storage of the token contract and delegates every call to the current implementation set.
 * Besides, it allows to upgrade the token's behaviour towards further implementations, and provides
 * authorization control functionalities
 */
contract EternalStorageProxy is EternalStorage {
    bytes32 internal constant OWNER = keccak256("owner");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");

    /**
    * @dev This event will be emitted every time the implementation gets upgraded
    * @param version representing the version number of the upgraded implementation
    * @param implementation representing the address of the upgraded implementation
    */
    event Upgraded(uint256 version, address indexed implementation);

    event OwnershipRenounced(address indexed previousOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyProxyStorage() {
        require(msg.sender == getProxyStorage());
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == getOwner());
        _;
    }

    constructor(address _proxyStorage, address _implementationAddress) public {
        require(_implementationAddress != address(0));

        if (_proxyStorage != address(0)) {
            _setProxyStorage(_proxyStorage);
        } else {
            _setProxyStorage(address(this));
        }
        
        _implementation = _implementationAddress;
        _setOwner(msg.sender);
    }

    /**
    * @dev Fallback function allowing to perform a delegatecall to the given implementation.
    * This function will return whatever the implementation call returns
    */
    // solhint-disable no-complex-fallback, no-inline-assembly
    function() external payable {
        address _impl = _implementation;
        require(_impl != address(0));

        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0
            calldatacopy(0, 0, calldatasize)

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet
            let result := delegatecall(gas, _impl, 0, calldatasize, 0, 0)

            // Copy the returned data
            returndatacopy(0, 0, returndatasize)

            switch result
            // delegatecall returns 0 on error
            case 0 { revert(0, returndatasize) }
            default { return(0, returndatasize) }
        }
    }
    // solhint-enable no-complex-fallback, no-inline-assembly

    function getOwner() public view returns(address) {
        return addressStorage[OWNER];
    }

    function getProxyStorage() public view returns(address) {
        return addressStorage[PROXY_STORAGE];
    }

    /**
     * @dev Allows the current owner to relinquish ownership.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipRenounced(getOwner());
        _setOwner(address(0));
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a _newOwner.
     * @param _newOwner The address to transfer ownership to.
     */
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0));
        emit OwnershipTransferred(getOwner(), _newOwner);
        _setOwner(_newOwner);
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
        emit Upgraded(_version, _implementation);
    }

    function _setProxyStorage(address _proxyStorage) private {
        addressStorage[PROXY_STORAGE] = _proxyStorage;
    }

    function _setOwner(address _owner) private {
        addressStorage[OWNER] = _owner;
    }
}
