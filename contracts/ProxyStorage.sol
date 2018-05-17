pragma solidity ^0.4.23;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IEternalStorageProxy.sol";
import "./eternal-storage/EternalStorage.sol";


contract ProxyStorage is EternalStorage, IProxyStorage {
    enum ContractTypes {
        Invalid,
        KeysManager,
        VotingToChangeKeys,
        VotingToChangeMinThreshold,
        VotingToChangeProxy,
        BallotsStorage,
        PoaConsensus,
        ValidatorMetadata,
        ProxyStorage
    }

    event ProxyInitialized(
        address keysManagerEternalStorage,
        address votingToChangeKeysEternalStorage,
        address votingToChangeMinThresholdEternalStorage,
        address votingToChangeProxyEternalStorage,
        address ballotsStorageEternalStorage,
        address validatorMetadataEternalStorage
    );

    event AddressSet(uint256 contractType, address contractAddress);

    modifier onlyVotingToChangeProxy() {
        require(msg.sender == getVotingToChangeProxy());
        _;
    }

    modifier onlyOwner() {
        require(_isOwner(msg.sender));
        _;
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[keccak256("initDisabled")];
    }

    function init(address _poaConsensus) public onlyOwner {
        require(!initDisabled());
        _setPoaConsensus(_poaConsensus);
        boolStorage[keccak256("initDisabled")] = true;
    }

    function mocInitialized() public view returns(bool) {
        return boolStorage[keccak256("mocInitialized")];
    }

    function getKeysManager() public view returns(address) {
        return addressStorage[keccak256("keysManagerEternalStorage")];
    }

    function getVotingToChangeKeys() public view returns(address) {
        return addressStorage[keccak256("votingToChangeKeysEternalStorage")];
    }

    function getVotingToChangeMinThreshold() public view returns(address) {
        return addressStorage[keccak256("votingToChangeMinThresholdEternalStorage")];
    }

    function getVotingToChangeProxy() public view returns(address) {
        return addressStorage[keccak256("votingToChangeProxyEternalStorage")];
    }

    function getPoaConsensus() public view returns(address) {
        return addressStorage[keccak256("poaConsensus")];
    }

    function getBallotsStorage() public view returns(address) {
        return addressStorage[keccak256("ballotsStorageEternalStorage")];
    }

    function getValidatorMetadata() public view returns(address) {
        return addressStorage[keccak256("validatorMetadataEternalStorage")];
    }

    function initializeAddresses(
        address _keysManagerEternalStorage,
        address _votingToChangeKeysEternalStorage,
        address _votingToChangeMinThresholdEternalStorage,
        address _votingToChangeProxyEternalStorage,
        address _ballotsStorageEternalStorage,
        address _validatorMetadataEternalStorage
    )
        public
    {
        require(isValidator(msg.sender) || _isOwner(msg.sender));
        require(!mocInitialized());
        addressStorage[keccak256("keysManagerEternalStorage")] =
            _keysManagerEternalStorage;
        addressStorage[keccak256("votingToChangeKeysEternalStorage")] =
            _votingToChangeKeysEternalStorage;
        addressStorage[keccak256("votingToChangeMinThresholdEternalStorage")] =
            _votingToChangeMinThresholdEternalStorage;
        addressStorage[keccak256("votingToChangeProxyEternalStorage")] =
            _votingToChangeProxyEternalStorage;
        addressStorage[keccak256("ballotsStorageEternalStorage")] =
            _ballotsStorageEternalStorage;
        addressStorage[keccak256("validatorMetadataEternalStorage")] =
            _validatorMetadataEternalStorage;
        boolStorage[keccak256("mocInitialized")] = true;
        emit ProxyInitialized(
            _keysManagerEternalStorage,
            _votingToChangeKeysEternalStorage,
            _votingToChangeMinThresholdEternalStorage,
            _votingToChangeProxyEternalStorage,
            _ballotsStorageEternalStorage,
            _validatorMetadataEternalStorage
        );
    }

    function setContractAddress(uint256 _contractType, address _contractAddress)
        public
        onlyVotingToChangeProxy
    {
        require(_contractAddress != address(0));
        if (_contractType == uint8(ContractTypes.KeysManager)) {
            IEternalStorageProxy(
                getKeysManager()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.VotingToChangeKeys)) {
            IEternalStorageProxy(
                getVotingToChangeKeys()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.VotingToChangeMinThreshold)) {
            IEternalStorageProxy(
                getVotingToChangeMinThreshold()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.VotingToChangeProxy)) {
            IEternalStorageProxy(
                getVotingToChangeProxy()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.BallotsStorage)) {
            IEternalStorageProxy(
                getBallotsStorage()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.PoaConsensus)) {
            _setPoaConsensus(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.ValidatorMetadata)) {
            IEternalStorageProxy(
                getValidatorMetadata()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint8(ContractTypes.ProxyStorage)) {
            IEternalStorageProxy(this).upgradeTo(_contractAddress);
        }
        emit AddressSet(_contractType, _contractAddress);
    }

    function isValidator(address _validator) public view returns(bool) {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(getPoaConsensus());
        return poa.isValidator(_validator);
    }

    function _isOwner(address _sender) private view returns(bool) {
        return _sender == addressStorage[keccak256("owner")];
    }

    function _setPoaConsensus(address _poaConsensus) private {
        addressStorage[keccak256("poaConsensus")] = _poaConsensus;
    }
}
