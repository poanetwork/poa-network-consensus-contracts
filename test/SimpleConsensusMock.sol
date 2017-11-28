import '../contracts/SimpleConsensus.sol';

contract SimpleConsensusMock is SimpleConsensus {
    //For testing
    // address public SYSTEM_ADDRESS = 0xfffffffffffffffffffffffffffffffffffffffe;
    function setSystemAddress(address _newAddress) public {
        SYSTEM_ADDRESS = _newAddress;
    }

    function setKeysManager(address _newAddress) public {
        keysManager = _newAddress;
    }

    function setBallotsManager(address _newAddress) public {
        ballotsManager = _newAddress;
    }
}