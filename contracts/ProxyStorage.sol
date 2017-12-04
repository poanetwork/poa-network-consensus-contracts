pragma solidity ^0.4.18;
import "./interfaces/IProxyStorage.sol";
contract ProxyStorage is IProxyStorage {
    address masterOfCeremony;
    address public poaConsensus = 0x0;
    address public keysManager;
    address public ballotsStorage;
    address public votingToChangeMinThreshold;
    address public votingToChangeKeys;
    address public proxyBallot;

    modifier onlyProxyBallot() {
      require(msg.sender == proxyBallot);
      _;
    }

    function ProxyStorage(address _poaConsensus, address _moc) {
      masterOfCeremony = _moc;
      poaConsensus = _poaConsensus;
    }
//     // function setKeysManager(address _keysManager) public onlyProxyBallot{}
//     // function setBallotsStorage(address _keysManager) public onlyProxyBallot{}
//     // function setVotingToChangeMinThreshold(address _keysManager) public onlyProxyBallot{}
//     // function setVotingToChangeKeys(address _keysManager) public onlyProxyBallot{}
    function getKeysManager() public view returns(address) {
        return keysManager;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return votingToChangeKeys;
    }

    function getVotingToChangeMinThreshold() public view returns(address) {
        return votingToChangeMinThreshold;
    }

    function getBallotsStorage() public view returns(address) {
        return ballotsStorage;
    }

    function initializeAddresses(
        address _keysManager,
        address _votingToChangeKeys,
        address _votingToChangeMinThreshold,
        address _ballotsStorage
      ) public 
    {
      require(msg.sender == masterOfCeremony);
      votingToChangeKeys = _votingToChangeKeys;
      votingToChangeMinThreshold = _votingToChangeMinThreshold;
      keysManager = _keysManager;
      ballotsStorage = _ballotsStorage;
    }
}