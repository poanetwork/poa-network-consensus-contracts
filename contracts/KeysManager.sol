pragma solidity ^0.4.24;

import "./libs/SafeMath.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";
import "./eternal-storage/EternalStorage.sol";


contract KeysManager is EternalStorage, IKeysManager {
    using SafeMath for uint256;

    bytes32 internal constant INIT_DISABLED =
        keccak256("initDisabled");
    
    bytes32 internal constant INITIAL_KEYS_COUNT =
        keccak256("initialKeysCount");
    
    bytes32 internal constant OWNER =
        keccak256("owner");
    
    bytes32 internal constant PREVIOUS_KEYS_MANAGER =
        keccak256("previousKeysManager");
    
    bytes32 internal constant PROXY_STORAGE =
        keccak256("proxyStorage");

    string internal constant INITIAL_KEY_STATUS = "initialKeyStatus";
    string internal constant IS_MINING_ACTIVE = "isMiningActive";
    string internal constant IS_PAYOUT_ACTIVE = "isPayoutActive";
    string internal constant IS_VOTING_ACTIVE = "isVotingActive";
    string internal constant MINING_KEY_BY_PAYOUT = "miningKeyByPayout";
    string internal constant MINING_KEY_BY_VOTING = "miningKeyByVoting";
    string internal constant MINING_KEY_HISTORY = "miningKeyHistory";
    string internal constant PAYOUT_KEY = "payoutKey";
    string internal constant SUCCESSFUL_VALIDATOR_CLONE = "successfulValidatorClone";
    string internal constant VALIDATOR_KEYS = "validatorKeys";
    string internal constant VOTING_KEY = "votingKey";

    enum InitialKeyState {Invalid, Activated, Deactivated}

    event MiningKeyChanged(address key, string action);
    event VotingKeyChanged(address key, address indexed miningKey, string action);
    event PayoutKeyChanged(address key, address indexed miningKey, string action);
    
    event ValidatorInitialized(
        address indexed miningKey,
        address indexed votingKey,
        address indexed payoutKey
    );

    event InitialKeyCreated(
        address indexed initialKey,
        uint256 time,
        uint256 initialKeysCount
    );
    
    event Migrated(string name, address key);

    modifier onlyOwner() {
        require(msg.sender == addressStorage[OWNER]);
        _;
    }

    modifier onlyVotingToChangeKeys() {
        require(msg.sender == getVotingToChangeKeys());
        _;
    }

    modifier onlyValidInitialKey() {
        require(getInitialKeyStatus(msg.sender) == uint8(InitialKeyState.Activated));
        _;
    }

    modifier withinTotalLimit() {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(poaNetworkConsensus());
        require(poa.getCurrentValidatorsLength() < maxLimitValidators());
        _;
    }

    function maxLimitValidators() public pure returns(uint256) {
        return 2000;
    }

    function masterOfCeremony() public view returns(address) {
        return IPoaNetworkConsensus(poaNetworkConsensus()).masterOfCeremony();
    }

    function previousKeysManager() public view returns(address) {
        return addressStorage[PREVIOUS_KEYS_MANAGER];
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[PROXY_STORAGE];
    }

    function poaNetworkConsensus() public view returns(address) {
        return IProxyStorage(proxyStorage()).getPoaConsensus();
    }

    function maxNumberOfInitialKeys() public pure returns(uint256) {
        return 12;
    }

    function initialKeysCount() public view returns(uint256) {
        return uintStorage[INITIAL_KEYS_COUNT];
    }

    function getInitialKeyStatus(address _initialKey) public view returns(uint8) {
        return uint8(uintStorage[
            keccak256(abi.encodePacked(INITIAL_KEY_STATUS, _initialKey))
        ]);
    }

    function miningKeyByPayout(address _payoutKey) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_BY_PAYOUT, _payoutKey))
        ];
    }

    function miningKeyByVoting(address _votingKey) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_BY_VOTING, _votingKey))
        ];
    }

    function miningKeyHistory(address _miningKey) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_HISTORY, _miningKey))
        ];
    }

    function successfulValidatorClone(address _miningKey) public view returns(bool) {
        return boolStorage[
            keccak256(abi.encodePacked(SUCCESSFUL_VALIDATOR_CLONE, _miningKey))
        ];
    }

    function validatorKeys(address _miningKey) public view returns(
        address votingKey,
        address payoutKey,
        bool isMiningActive,
        bool isVotingActive,
        bool isPayoutActive
    ) {
        votingKey = this.getVotingByMining(_miningKey);
        payoutKey = this.getPayoutByMining(_miningKey);
        isMiningActive = this.isMiningActive(_miningKey);
        isVotingActive = this.isVotingActiveByMiningKey(_miningKey);
        isPayoutActive = this.isPayoutActive(_miningKey);
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[INIT_DISABLED];
    }

    function init(
        address _previousKeysManager
    ) public onlyOwner {
        require(!initDisabled());
        address _masterOfCeremony = masterOfCeremony();
        require(_masterOfCeremony != address(0));
        require(_masterOfCeremony != poaNetworkConsensus());
        _setVotingKey(address(0), _masterOfCeremony);
        _setPayoutKey(address(0), _masterOfCeremony);
        _setIsMiningActive(true, _masterOfCeremony);
        _setIsVotingActive(false, _masterOfCeremony);
        _setIsPayoutActive(false, _masterOfCeremony);
        _setSuccessfulValidatorClone(true, _masterOfCeremony);
        emit Migrated("miningKey", _masterOfCeremony);
        if (_previousKeysManager != address(0)) {
            _setPreviousKeysManager(_previousKeysManager);
            IKeysManager previous = IKeysManager(_previousKeysManager);
            _setInitialKeysCount(previous.initialKeysCount());
        }
        boolStorage[INIT_DISABLED] = true;
    }

    function migrateMiningKey(
        address _miningKey,
        uint8 _maxMiningKeyHistoryDeep
    ) public onlyOwner {
        require(previousKeysManager() != address(0));
        IKeysManager previous = IKeysManager(previousKeysManager());
        require(_miningKey != address(0));
        require(previous.isMiningActive(_miningKey));
        require(!isMiningActive(_miningKey));
        require(!successfulValidatorClone(_miningKey));
        address votingKey = previous.getVotingByMining(_miningKey);
        address payoutKey = previous.getPayoutByMining(_miningKey);
        _setVotingKey(votingKey, _miningKey);
        _setPayoutKey(payoutKey, _miningKey);
        _setIsMiningActive(previous.isMiningActive(_miningKey), _miningKey);
        _setIsVotingActive(previous.isVotingActive(votingKey), _miningKey);
        _setIsPayoutActive(previous.isPayoutActive(_miningKey), _miningKey);
        _setMiningKeyByVoting(votingKey, _miningKey);
        _setMiningKeyByPayout(payoutKey, _miningKey);
        _setSuccessfulValidatorClone(true, _miningKey);
        address currentMiningKey = _miningKey;
        for (uint8 i = 0; i < _maxMiningKeyHistoryDeep; i++) {
            address oldMiningKey = previous.getMiningKeyHistory(currentMiningKey);
            if (oldMiningKey == 0) {
                break;
            }
            _setMiningKeyHistory(currentMiningKey, oldMiningKey);
            currentMiningKey = oldMiningKey;
        }
        emit Migrated("miningKey", _miningKey);
    }

    function migrateInitialKey(address _initialKey) public onlyOwner {
        require(getInitialKeyStatus(_initialKey) == uint8(InitialKeyState.Invalid));
        require(_initialKey != address(0));
        require(previousKeysManager() != address(0));
        IKeysManagerPrev previous = IKeysManagerPrev(previousKeysManager());
        uint8 status = previous.getInitialKey(_initialKey);
        require(
            status == uint8(InitialKeyState.Activated) ||
            status == uint8(InitialKeyState.Deactivated)
        );
        _setInitialKeyStatus(_initialKey, status);
        emit Migrated("initialKey", _initialKey);
    }

    function initiateKeys(address _initialKey) public {
        require(msg.sender == masterOfCeremony());
        require(_initialKey != address(0));
        require(getInitialKeyStatus(_initialKey) == uint8(InitialKeyState.Invalid));
        require(_initialKey != masterOfCeremony());
        uint256 _initialKeysCount = initialKeysCount();
        require(_initialKeysCount < maxNumberOfInitialKeys());
        _setInitialKeyStatus(_initialKey, uint8(InitialKeyState.Activated));
        _initialKeysCount = _initialKeysCount.add(1);
        _setInitialKeysCount(_initialKeysCount);
        emit InitialKeyCreated(_initialKey, getTime(), _initialKeysCount);
    }

    function createKeys(
        address _miningKey,
        address _votingKey,
        address _payoutKey
    )
        public
        onlyValidInitialKey
        withinTotalLimit
    {
        require(_miningKey != address(0));
        require(_votingKey != address(0));
        require(_payoutKey != address(0));
        require(_miningKey != _votingKey);
        require(_miningKey != _payoutKey);
        require(_votingKey != _payoutKey);
        require(_miningKey != msg.sender);
        require(_votingKey != msg.sender);
        require(_payoutKey != msg.sender);
        require(!isMiningActive(_miningKey));
        require(miningKeyByVoting(_votingKey) == address(0));
        require(miningKeyByPayout(_payoutKey) == address(0));
        require(getVotingByMining(_miningKey) == address(0));
        require(getPayoutByMining(_miningKey) == address(0));
        _setVotingKey(_votingKey, _miningKey);
        _setPayoutKey(_payoutKey, _miningKey);
        _setIsMiningActive(true, _miningKey);
        _setIsVotingActive(true, _miningKey);
        _setIsPayoutActive(true, _miningKey);
        _setMiningKeyByVoting(_votingKey, _miningKey);
        _setMiningKeyByPayout(_payoutKey, _miningKey);
        _setInitialKeyStatus(msg.sender, uint8(InitialKeyState.Deactivated));
        IPoaNetworkConsensus(poaNetworkConsensus()).addValidator(_miningKey, true);
        emit ValidatorInitialized(_miningKey, _votingKey, _payoutKey);
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return IProxyStorage(proxyStorage()).getVotingToChangeKeys();
    }

    function isMiningActive(address _key) public view returns(bool) {
        return boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _key, IS_MINING_ACTIVE))
        ];
    }

    function isVotingActive(address _votingKey) public view returns(bool) {
        address miningKey = miningKeyByVoting(_votingKey);
        return isVotingActiveByMiningKey(miningKey);
    }

    function isVotingActiveByMiningKey(address _miningKey) public view returns(bool) {
        return boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, IS_VOTING_ACTIVE))
        ];
    }

    function isPayoutActive(address _miningKey) public view returns(bool) {
        return boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, IS_PAYOUT_ACTIVE))
        ];
    }

    function getVotingByMining(address _miningKey) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, VOTING_KEY))
        ];
    }

    function getPayoutByMining(address _miningKey) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, PAYOUT_KEY))
        ];
    }

    function getMiningKeyHistory(address _miningKey) public view returns(address) {
        return miningKeyHistory(_miningKey);
    }

    function getMiningKeyByVoting(address _votingKey) public view returns(address) {
        return miningKeyByVoting(_votingKey);
    }

    function addMiningKey(address _key) public onlyVotingToChangeKeys withinTotalLimit {
        _addMiningKey(_key);
    }

    function addVotingKey(address _key, address _miningKey) public onlyVotingToChangeKeys {
        _addVotingKey(_key, _miningKey);
    }

    function addPayoutKey(address _key, address _miningKey) public onlyVotingToChangeKeys {
        _addPayoutKey(_key, _miningKey);
    }

    function removeMiningKey(address _key) public onlyVotingToChangeKeys {
        _removeMiningKey(_key);
    }

    function removeVotingKey(address _miningKey) public onlyVotingToChangeKeys {
        _removeVotingKey(_miningKey);
    }

    function removePayoutKey(address _miningKey) public onlyVotingToChangeKeys {
        _removePayoutKey(_miningKey);
    }

    function swapMiningKey(address _key, address _oldMiningKey)
        public
        onlyVotingToChangeKeys
    {
        require(_key != _oldMiningKey);
        require(isMiningActive(_oldMiningKey));
        _setMiningKeyHistory(_key, _oldMiningKey);
        address votingKey = getVotingByMining(_oldMiningKey);
        address payoutKey = getPayoutByMining(_oldMiningKey);
        _setVotingKey(votingKey, _key);
        _setPayoutKey(payoutKey, _key);
        _setIsMiningActive(true, _key);
        _setIsVotingActive(isVotingActive(votingKey), _key);
        _setIsPayoutActive(isPayoutActive(_oldMiningKey), _key);
        IPoaNetworkConsensus(poaNetworkConsensus()).swapValidatorKey(_key, _oldMiningKey);
        _clearMiningKey(_oldMiningKey);
        _setMiningKeyByVoting(votingKey, _key);
        _setMiningKeyByPayout(payoutKey, _key);
        emit MiningKeyChanged(_key, "swapped");
    }

    function swapVotingKey(address _key, address _miningKey) public onlyVotingToChangeKeys {
        _swapVotingKey(_key, _miningKey);
    }

    function swapPayoutKey(address _key, address _miningKey) public onlyVotingToChangeKeys {
        _swapPayoutKey(_key, _miningKey);
    }

    function _swapVotingKey(address _key, address _miningKey) private {
        _removeVotingKey(_miningKey);
        _addVotingKey(_key, _miningKey);
    }

    function _swapPayoutKey(address _key, address _miningKey) private {
        _removePayoutKey(_miningKey);
        _addPayoutKey(_key, _miningKey);
    }

    function _addMiningKey(address _key) private {
        require(initDisabled());
        _setVotingKey(address(0), _key);
        _setPayoutKey(address(0), _key);
        _setIsMiningActive(true, _key);
        _setIsVotingActive(false, _key);
        _setIsPayoutActive(false, _key);
        IPoaNetworkConsensus(poaNetworkConsensus()).addValidator(_key, true);
        emit MiningKeyChanged(_key, "added");
    }

    function _addVotingKey(address _key, address _miningKey) private {
        require(initDisabled());
        require(isMiningActive(_miningKey));
        require(_key != _miningKey);
        require(miningKeyByVoting(_key) == address(0));
        address oldVotingKey = getVotingByMining(_miningKey);
        if (isVotingActiveByMiningKey(_miningKey) && oldVotingKey != address(0)) {
            _swapVotingKey(_key, _miningKey);
        } else {
            _setVotingKey(_key, _miningKey);
            _setIsVotingActive(true, _miningKey);
            _setMiningKeyByVoting(_key, _miningKey);
            emit VotingKeyChanged(_key, _miningKey, "added");
        }
    }

    function _addPayoutKey(address _key, address _miningKey) private {
        require(initDisabled());
        require(isMiningActive(_miningKey));
        require(_key != _miningKey);
        require(miningKeyByPayout(_key) == address(0));
        address oldPayoutKey = getPayoutByMining(_miningKey);
        if (isPayoutActive(_miningKey) && oldPayoutKey != address(0)) {
            _swapPayoutKey(_key, _miningKey);
        } else {
            _setPayoutKey(_key, _miningKey);
            _setIsPayoutActive(true, _miningKey);
            _setMiningKeyByPayout(_key, _miningKey);
            emit PayoutKeyChanged(_key, _miningKey, "added");
        }
    }

    function _clearMiningKey(address _miningKey) private {
        _setVotingKey(address(0), _miningKey);
        _setPayoutKey(address(0), _miningKey);
        _setIsMiningActive(false, _miningKey);
        _setIsVotingActive(false, _miningKey);
        _setIsPayoutActive(false, _miningKey);
    }

    function _removeMiningKey(address _key) private {
        require(initDisabled());
        if (!isMiningActive(_key)) return;
        address votingKey = getVotingByMining(_key);
        address payoutKey = getPayoutByMining(_key);
        _setMiningKeyByVoting(votingKey, address(0));
        _setMiningKeyByPayout(payoutKey, address(0));
        _clearMiningKey(_key);
        if (_key == masterOfCeremony()) {
            require(initialKeysCount() >= maxNumberOfInitialKeys());
        }
        IPoaNetworkConsensus(poaNetworkConsensus()).removeValidator(_key, true);
        emit MiningKeyChanged(_key, "removed");
        if (votingKey != address(0)) {
            emit VotingKeyChanged(votingKey, _key, "removed");
        }
        if (payoutKey != address(0)) {
            emit PayoutKeyChanged(payoutKey, _key, "removed");
        }
    }

    function _removeVotingKey(address _miningKey) private {
        require(initDisabled());
        if (!isVotingActiveByMiningKey(_miningKey)) return;
        address oldVoting = getVotingByMining(_miningKey);
        _setVotingKey(address(0), _miningKey);
        _setIsVotingActive(false, _miningKey);
        _setMiningKeyByVoting(oldVoting, address(0));
        emit VotingKeyChanged(oldVoting, _miningKey, "removed");
    }

    function _removePayoutKey(address _miningKey) private {
        require(initDisabled());
        if (!isPayoutActive(_miningKey)) return;
        address oldPayout = getPayoutByMining(_miningKey);
        _setPayoutKey(address(0), _miningKey);
        _setIsPayoutActive(false, _miningKey);
        _setMiningKeyByPayout(oldPayout, address(0));
        emit PayoutKeyChanged(oldPayout, _miningKey, "removed");
    }

    function _setPreviousKeysManager(address _keysManager) private {
        addressStorage[PREVIOUS_KEYS_MANAGER] = _keysManager;
    }

    function _setInitialKeysCount(uint256 _count) private {
        uintStorage[INITIAL_KEYS_COUNT] = _count;
    }

    function _setInitialKeyStatus(address _initialKey, uint8 _status) private {
        uintStorage[
            keccak256(abi.encodePacked(INITIAL_KEY_STATUS, _initialKey))
        ] = _status;
    }

    function _setVotingKey(address _key, address _miningKey) private {
        addressStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, VOTING_KEY))
        ] = _key;
    }

    function _setPayoutKey(address _key, address _miningKey) private {
        addressStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, PAYOUT_KEY))
        ] = _key;
    }

    function _setIsMiningActive(bool _active, address _miningKey) private {
        boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, IS_MINING_ACTIVE))
        ] = _active;
    }

    function _setIsVotingActive(bool _active, address _miningKey) private {
        boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, IS_VOTING_ACTIVE))
        ] = _active;
    }

    function _setIsPayoutActive(bool _active, address _miningKey) private {
        boolStorage[
            keccak256(abi.encodePacked(VALIDATOR_KEYS, _miningKey, IS_PAYOUT_ACTIVE))
        ] = _active;
    }

    function _setMiningKeyByPayout(address _payoutKey, address _miningKey) private {
        if (_payoutKey == address(0)) return;
        addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_BY_PAYOUT, _payoutKey))
        ] = _miningKey;
    }

    function _setMiningKeyByVoting(address _votingKey, address _miningKey) private {
        if (_votingKey == address(0)) return;
        addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_BY_VOTING, _votingKey))
        ] = _miningKey;
    }

    function _setMiningKeyHistory(address _key, address _oldMiningKey) private {
        addressStorage[
            keccak256(abi.encodePacked(MINING_KEY_HISTORY, _key))
        ] = _oldMiningKey;
    }

    function _setSuccessfulValidatorClone(bool _success, address _miningKey) private {
        boolStorage[
            keccak256(abi.encodePacked(SUCCESSFUL_VALIDATOR_CLONE, _miningKey))
        ] = _success;
    }
}
