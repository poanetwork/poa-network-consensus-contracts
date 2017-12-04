pragma solidity ^0.4.18;

contract ProxyStorage {
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
    function getKeysManagerAddress() public view returns(address) {
        return keysManager;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return votingToChangeKeys;
    }
    function initializeAddresses(
        address _keysManager,
        address _votingToChangeKeys,
        address _ballotsStorage
      ) public 
    {
      require(msg.sender == masterOfCeremony);
      votingToChangeKeys = _votingToChangeKeys;
      keysManager = _keysManager;
      ballotsStorage = _ballotsStorage;
    }
}