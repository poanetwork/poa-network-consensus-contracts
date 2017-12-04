pragma solidity ^0.4.18;
import '../../contracts/PoaNetworkConsensus.sol';
import '../../contracts/ProxyStorage.sol';

contract PoaNetworkConsensusMock is PoaNetworkConsensus {
    //For testing
    // address public systemAddress = 0xfffffffffffffffffffffffffffffffffffffffe;
    function PoaNetworkConsensusMock() PoaNetworkConsensus() {}
    function setSystemAddress(address _newAddress) public {
        systemAddress = _newAddress;
    }

    function setProxyStorageMock(address _newAddress) public {
        proxyStorage = ProxyStorage(_newAddress);
    }

    function setMoCMock(address _newAddress) public {
        masterOfCeremony = _newAddress;
    }

    function setCurrentValidatorsLength(uint256 _newNumber) public {
        currentValidatorsLength = _newNumber;
    }
}