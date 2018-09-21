pragma solidity ^0.4.24;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IEternalStorageProxy.sol";
import "./eternal-storage/EternalStorage.sol";


contract ProxyStorage is EternalStorage, IProxyStorage {
    bytes32 internal constant INIT_DISABLED =
        keccak256("initDisabled");
    
    bytes32 internal constant BALLOTS_STORAGE_ETERNAL_STORAGE =
        keccak256("ballotsStorageEternalStorage");
    
    bytes32 internal constant KEYS_MANAGER_ETERNAL_STORAGE =
        keccak256("keysManagerEternalStorage");
    
    bytes32 internal constant MOC_INITIALIZED =
        keccak256("mocInitialized");
    
    bytes32 internal constant OWNER =
        keccak256("owner");
    
    bytes32 internal constant POA_CONSENSUS =
        keccak256("poaConsensus");

    bytes32 internal constant REWARD_BY_BLOCK_ETERNAL_STORAGE = 
        keccak256("rewardByBlockEternalStorage");
    
    bytes32 internal constant VALIDATOR_METADATA_ETERNAL_STORAGE =
        keccak256("validatorMetadataEternalStorage");
    
    bytes32 internal constant VOTING_TO_CHANGE_KEYS_ETERNAL_STORAGE =
        keccak256("votingToChangeKeysEternalStorage");
    
    bytes32 internal constant VOTING_TO_CHANGE_MIN_THRESHOLD_ETERNAL_STORAGE =
        keccak256("votingToChangeMinThresholdEternalStorage");
    
    bytes32 internal constant VOTING_TO_CHANGE_PROXY_ETERNAL_STORAGE =
        keccak256("votingToChangeProxyEternalStorage");

    bytes32 internal constant VOTING_TO_MANAGE_EMISSION_FUNDS_ETERNAL_STORAGE = 
        keccak256("votingToManageEmissionFundsEternalStorage");

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
        address votingToManageEmissionFundsEternalStorage,
        address ballotsStorageEternalStorage,
        address validatorMetadataEternalStorage,
        address rewardByBlockEternalStorage
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
        return boolStorage[INIT_DISABLED];
    }

    function init(address _poaConsensus) public onlyOwner {
        require(!initDisabled());
        require(_poaConsensus != address(0));
        require(_poaConsensus != address(this));
        _setPoaConsensus(_poaConsensus);
        boolStorage[INIT_DISABLED] = true;
    }

    function mocInitialized() public view returns(bool) {
        return boolStorage[MOC_INITIALIZED];
    }

    function getKeysManager() public view returns(address) {
        return addressStorage[KEYS_MANAGER_ETERNAL_STORAGE];
    }

    function getVotingToChangeKeys() public view returns(address) {
        return addressStorage[VOTING_TO_CHANGE_KEYS_ETERNAL_STORAGE];
    }

    function getVotingToChangeMinThreshold() public view returns(address) {
        return addressStorage[VOTING_TO_CHANGE_MIN_THRESHOLD_ETERNAL_STORAGE];
    }

    function getVotingToChangeProxy() public view returns(address) {
        return addressStorage[VOTING_TO_CHANGE_PROXY_ETERNAL_STORAGE];
    }

    function getVotingToManageEmissionFunds() public view returns(address) {
        return addressStorage[VOTING_TO_MANAGE_EMISSION_FUNDS_ETERNAL_STORAGE];
    }

    function getPoaConsensus() public view returns(address) {
        return addressStorage[POA_CONSENSUS];
    }

    function getBallotsStorage() public view returns(address) {
        return addressStorage[BALLOTS_STORAGE_ETERNAL_STORAGE];
    }

    function getValidatorMetadata() public view returns(address) {
        return addressStorage[VALIDATOR_METADATA_ETERNAL_STORAGE];
    }

    function getRewardByBlock() public view returns(address) {
        return addressStorage[REWARD_BY_BLOCK_ETERNAL_STORAGE];
    }

    function initializeAddresses(
        address _keysManagerEternalStorage,
        address _votingToChangeKeysEternalStorage,
        address _votingToChangeMinThresholdEternalStorage,
        address _votingToChangeProxyEternalStorage,
        address _votingToManageEmissionFundsEternalStorage,
        address _ballotsStorageEternalStorage,
        address _validatorMetadataEternalStorage,
        address _rewardByBlockEternalStorage
    ) public {
        require(_isOwner(msg.sender) || _isMoC(msg.sender));
        require(!mocInitialized());
        addressStorage[KEYS_MANAGER_ETERNAL_STORAGE] =
            _keysManagerEternalStorage;
        addressStorage[VOTING_TO_CHANGE_KEYS_ETERNAL_STORAGE] =
            _votingToChangeKeysEternalStorage;
        addressStorage[VOTING_TO_CHANGE_MIN_THRESHOLD_ETERNAL_STORAGE] =
            _votingToChangeMinThresholdEternalStorage;
        addressStorage[VOTING_TO_CHANGE_PROXY_ETERNAL_STORAGE] =
            _votingToChangeProxyEternalStorage;
        addressStorage[VOTING_TO_MANAGE_EMISSION_FUNDS_ETERNAL_STORAGE] =
            _votingToManageEmissionFundsEternalStorage;
        addressStorage[BALLOTS_STORAGE_ETERNAL_STORAGE] =
            _ballotsStorageEternalStorage;
        addressStorage[VALIDATOR_METADATA_ETERNAL_STORAGE] =
            _validatorMetadataEternalStorage;
        addressStorage[REWARD_BY_BLOCK_ETERNAL_STORAGE] = 
            _rewardByBlockEternalStorage;
        boolStorage[MOC_INITIALIZED] = true;
        emit ProxyInitialized(
            _keysManagerEternalStorage,
            _votingToChangeKeysEternalStorage,
            _votingToChangeMinThresholdEternalStorage,
            _votingToChangeProxyEternalStorage,
            _votingToManageEmissionFundsEternalStorage,
            _ballotsStorageEternalStorage,
            _validatorMetadataEternalStorage,
            _rewardByBlockEternalStorage
        );
    }

    // solhint-disable code-complexity
    function setContractAddress(uint256 _contractType, address _contractAddress)
        public
        onlyVotingToChangeProxy
        returns(bool)
    {
        if (!mocInitialized()) return false;
        if (!initDisabled()) return false;
        if (_contractAddress == address(0)) return false;
        bool success = false;
        if (_contractType == uint256(ContractTypes.KeysManager)) {
            success = IEternalStorageProxy(
                getKeysManager()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.VotingToChangeKeys)) {
            success = IEternalStorageProxy(
                getVotingToChangeKeys()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.VotingToChangeMinThreshold)) {
            success = IEternalStorageProxy(
                getVotingToChangeMinThreshold()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.VotingToChangeProxy)) {
            success = IEternalStorageProxy(
                getVotingToChangeProxy()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.BallotsStorage)) {
            success = IEternalStorageProxy(
                getBallotsStorage()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.PoaConsensus)) {
            _setPoaConsensus(_contractAddress);
            success = true;
        } else if (_contractType == uint256(ContractTypes.ValidatorMetadata)) {
            success = IEternalStorageProxy(
                getValidatorMetadata()
            ).upgradeTo(_contractAddress);
        } else if (_contractType == uint256(ContractTypes.ProxyStorage)) {
            success = IEternalStorageProxy(this).upgradeTo(_contractAddress);
        }
        if (success) {
            emit AddressSet(_contractType, _contractAddress);
        }
        return success;
    }
    // solhint-enable code-complexity

    function _isMoC(address _validator) private view returns(bool) {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(getPoaConsensus());
        return _validator == poa.masterOfCeremony() && !poa.isMasterOfCeremonyRemoved();
    }

    function _isOwner(address _sender) private view returns(bool) {
        return _sender == addressStorage[OWNER];
    }

    function _setPoaConsensus(address _poaConsensus) private {
        addressStorage[POA_CONSENSUS] = _poaConsensus;
    }
}
