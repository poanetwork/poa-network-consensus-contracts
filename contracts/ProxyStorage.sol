pragma solidity ^0.4.18;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IEternalStorageProxy.sol";

contract ProxyStorage is IProxyStorage {
    address poaConsensus;
    address keysManager;
    address votingToChangeKeysEternalStorage;
    address votingToChangeMinThreshold;
    address votingToChangeProxy;
    address ballotsStorageEternalStorage;
    address validatorMetadataEternalStorage;
    bool public mocInitialized;
    uint8 public contractVersion = 3;

    enum ContractTypes {
        Invalid,
        KeysManager,
        VotingToChangeKeys,
        VotingToChangeMinThreshold,
        VotingToChangeProxy,
        BallotsStorage,
        PoaConsensus,
        ValidatorMetadata,
        ValidatorMetadataEternalStorage,
        BallotsStorageEternalStorage,
        VotingToChangeKeysEternalStorage
    }

    event ProxyInitialized(
        address keysManager,
        address votingToChangeKeysEternalStorage,
        address votingToChangeMinThreshold,
        address votingToChangeProxy,
        address ballotsStorageEternalStorage,
        address validatorMetadataEternalStorage
    );

    event AddressSet(uint256 contractType, address contractAddress);

    modifier onlyVotingToChangeProxy() {
        require(msg.sender == votingToChangeProxy);
        _;
    }

    function ProxyStorage(address _poaConsensus) public {
        poaConsensus = _poaConsensus;
    }

    function getKeysManager() public view returns(address) {
        return keysManager;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return votingToChangeKeysEternalStorage;
    }

    function getVotingToChangeMinThreshold() public view returns(address) {
        return votingToChangeMinThreshold;
    }

    function getVotingToChangeProxy() public view returns(address) {
        return votingToChangeProxy;
    }

    function getPoaConsensus() public view returns(address) {
        return poaConsensus;
    }

    function getBallotsStorage() public view returns(address) {
        return ballotsStorageEternalStorage;
    }

    function getValidatorMetadata() public view returns(address) {
        return validatorMetadataEternalStorage;
    }

    function initializeAddresses(
        address _keysManager,
        address _votingToChangeKeysEternalStorage,
        address _votingToChangeMinThreshold,
        address _votingToChangeProxy,
        address _ballotsStorageEternalStorage,
        address _validatorMetadataEternalStorage
    )
        public
    {
        require(isValidator(msg.sender));
        require(!mocInitialized);
        keysManager = _keysManager;
        votingToChangeKeysEternalStorage = _votingToChangeKeysEternalStorage;
        votingToChangeMinThreshold = _votingToChangeMinThreshold;
        votingToChangeProxy = _votingToChangeProxy;
        ballotsStorageEternalStorage = _ballotsStorageEternalStorage;
        validatorMetadataEternalStorage = _validatorMetadataEternalStorage;
        mocInitialized = true;
        ProxyInitialized(
            keysManager,
            votingToChangeKeysEternalStorage,
            votingToChangeMinThreshold,
            votingToChangeProxy,
            ballotsStorageEternalStorage,
            validatorMetadataEternalStorage
        );
    }

    function setContractAddress(uint256 _contractType, address _contractAddress)
        public
        onlyVotingToChangeProxy
    {
        require(_contractAddress != address(0));
        if (_contractType == uint8(ContractTypes.KeysManager)) {
            keysManager = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeKeys)) {
            IEternalStorageProxy(votingToChangeKeysEternalStorage).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.VotingToChangeKeysEternalStorage)) {
            votingToChangeKeysEternalStorage = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeMinThreshold)) {
            votingToChangeMinThreshold = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.VotingToChangeProxy)) {
            votingToChangeProxy = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.BallotsStorage)) {
            IEternalStorageProxy(ballotsStorageEternalStorage).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.BallotsStorageEternalStorage)) {
            ballotsStorageEternalStorage = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.PoaConsensus)) {
            poaConsensus = _contractAddress;
        } else if (_contractType == uint8(ContractTypes.ValidatorMetadata)) {
            IEternalStorageProxy(validatorMetadataEternalStorage).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.ValidatorMetadataEternalStorage)) {
            validatorMetadataEternalStorage = _contractAddress;
        }
        AddressSet(_contractType, _contractAddress);
    }

    function isValidator(address _validator) public view returns(bool) {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(poaConsensus);
        return poa.isValidator(_validator);
    }
}
