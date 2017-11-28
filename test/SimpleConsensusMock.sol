import '../contracts/SimpleConsensus.sol';

contract SimpleConsensusMock is SimpleConsensus {
    //For testing
    // address public systemAddress = 0xfffffffffffffffffffffffffffffffffffffffe;
    function setSystemAddress(address _newAddress) public {
        systemAddress = _newAddress;
    }

    function setKeysManager(address _newAddress) public {
        keysManager = _newAddress;
    }

    function setBallotsManager(address _newAddress) public {
        ballotsManager = _newAddress;
    }
}