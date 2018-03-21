pragma solidity ^0.4.18;

import './EternalStorage.sol';
import '../SafeMath.sol';

/**
 * @title EternalStorageProxy
 * @dev This proxy holds the storage of the token contract and delegates every call to the current implementation set.
 * Besides, it allows to upgrade the token's behaviour towards further implementations, and provides
 * authorization control functionalities
 */
contract EternalStorageProxy is EternalStorage {
  using SafeMath for uint256;

  address public proxyStorage;

  /**
  * @dev This event will be emitted every time the implementation gets upgraded
  * @param version representing the version number of the upgraded implementation
  * @param implementation representing the address of the upgraded implementation
  */
  event Upgraded(uint256 version, address indexed implementation);

  modifier onlyProxyStorage() {
    require(msg.sender == proxyStorage);
    _;
  }

  function EternalStorageProxy(address _proxyStorage) public {
    proxyStorage = _proxyStorage;
  }

  /**
   * @dev Allows ProxyStorage contract to upgrade the current implementation.
   * @param implementation representing the address of the new implementation to be set.
   */
  function upgradeTo(address implementation) public onlyProxyStorage {
    require(_implementation != implementation);
    _version = _version.add(1);
    _implementation = implementation;
    Upgraded(_version, _implementation);
  }

  /**
   * @dev Allows ProxyStorage contract to upgrade the current implementation and call the new implementation
   * to initialize whatever is needed through a low level call.
   * @param implementation representing the address of the new implementation to be set.
   * @param data represents the msg.data to bet sent in the low level call. This parameter may include the function
   * signature of the implementation to be called with the needed payload
   */
  function upgradeToAndCall(address implementation, bytes data)
    payable
    public
    onlyProxyStorage
  {
    upgradeTo(implementation);
    require(this.call.value(msg.value)(data));
  }

  /**
  * @dev Fallback function allowing to perform a delegatecall to the given implementation.
  * This function will return whatever the implementation call returns
  */
  function () payable public {
    require(_implementation != address(0));
    bytes memory data = msg.data;

    assembly {
      let result := delegatecall(gas, _implementation, add(data, 0x20), mload(data), 0, 0)
      let size := returndatasize

      let ptr := mload(0x40)
      returndatacopy(ptr, 0, size)

      switch result
      case 0 { revert(ptr, size) }
      default { return(ptr, size) }
    }
  }

}