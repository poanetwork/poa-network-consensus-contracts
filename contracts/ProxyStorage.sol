pragma solidity ^0.4.18;
import "./interfaces/IProxyStorage.sol";


contract ProxyStorage is IProxyStorage {
    address public masterOfCeremony;
    address poaConsensus;
    address public keysManager;
    address public votingToChangeMinThreshold;
    address public votingToChangeKeys;
    address public votingToChangeProxy;
    address public ballotsStorage;
    bool public mocInitialized;

    enum ContractTypes {
        Invalid,
        KeysManager,
        VotingToChangeKeys,
        VotingToChangeMinThreshold,
        VotingToChangeProxy,
        BallotsStorage 
    }

    event ProxyInitialized(
        address keysManager,
        address votingToChangeKeys,
        address votingToChangeMinThreshold,
        address votingToChangeProxy,
        address ballotsStorage);

    event AddressSet(uint256 contractType, address contractAddress);

    modifier onlyVotingToChangeProxy() {
        require(msg.sender == votingToChangeProxy);
        _;
    }

    function ProxyStorage(address _poaConsensus, address _moc) public {
        poaConsensus = _poaConsensus;
        masterOfCeremony = _moc;
    }

    function getKeysManager() public view returns(address) {
        return keysManager;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return votingToChangeKeys;
    }

    function getVotingToChangeMinThreshold() public view returns(address) {
        return votingToChangeMinThreshold;
    }

    function getVotingToChangeProxy() public view returns(address) {
        return votingToChangeProxy;
    }

    function getBallotsStorage() public view returns(address) {
        return ballotsStorage;
    }

    function getPoaConsensus() public view returns(address) {
        return poaConsensus;
    }

    function initializeAddresses(
        address _keysManager,
        address _votingToChangeKeys,
        address _votingToChangeMinThreshold,
        address _votingToChangeProxy,
        address _ballotsStorage
    ) public 
    {
        require(msg.sender == masterOfCeremony);
        require(!mocInitialized);
        votingToChangeKeys = _votingToChangeKeys;
        votingToChangeMinThreshold = _votingToChangeMinThreshold;
        votingToChangeProxy = _votingToChangeProxy;
        keysManager = _keysManager;
        ballotsStorage = _ballotsStorage;
        mocInitialized = true;
        ProxyInitialized(
            keysManager,
            votingToChangeKeys,
            votingToChangeMinThreshold,
            votingToChangeProxy,
            ballotsStorage);
    }

    function setContractAddress(uint256 _contractType, address _contractAddress) public onlyVotingToChangeProxy {
        require(_contractAddress != address(0));
        if (_contractType == uint8(ContractTypes.KeysManager)) {
            keysManager = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeKeys)) {
            votingToChangeKeys = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeMinThreshold)) {
            votingToChangeMinThreshold = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeProxy)) {
            votingToChangeProxy = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.BallotsStorage)) {
            ballotsStorage = _contractAddress;
        }
        AddressSet(_contractType, _contractAddress);
    }
}