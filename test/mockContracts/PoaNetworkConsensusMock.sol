pragma solidity ^0.4.18;
import '../../contracts/PoaNetworkConsensus.sol';

contract PoaNetworkConsensusMock is PoaNetworkConsensus {
    //For testing
    // address public systemAddress = 0xfffffffffffffffffffffffffffffffffffffffe;
    function setSystemAddress(address _newAddress) public {
        systemAddress = _newAddress;
    }

    function setKeysManagerMock(address _newAddress) public {
        keysManager = _newAddress;
    }

    function setBallotsManagerMock(address _newAddress) public {
        ballotsManager = _newAddress;
    }

    function setBallotsStorageMock(address _newAddress) public {
        ballotsStorage = _newAddress;
    }

    function setCurrentValidatorsLength(uint256 _newNumber) public {
        currentValidatorsLength = _newNumber;
    }
}