pragma solidity ^0.4.23;

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

    bytes32 internal constant IS_MASTER_OF_CEREMONY_REMOVED = 
        keccak256("isMasterOfCeremonyRemoved");
    
    bytes32 internal constant MASTER_OF_CEREMONY =
        keccak256("masterOfCeremony");
    
    bytes32 internal constant OWNER =
        keccak256("owner");
    
    bytes32 internal constant POA_NETWORK_CONSENSUS =
        keccak256("poaNetworkConsensus");
    
    bytes32 internal constant PREVIOUS_KEYS_MANAGER =
        keccak256("previousKeysManager");
    
    bytes32 internal constant PROXY_STORAGE =
        keccak256("proxyStorage");

    string internal constant INITIAL_KEYS = "initialKeys";
    string internal constant IS_MINING_ACTIVE = "isMiningActive";
    string internal constant IS_PAYOUT_ACTIVE = "isPayoutActive";
    string internal constant IS_VOTING_ACTIVE = "isVotingActive";
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
        require(initialKeys(msg.sender) == uint8(InitialKeyState.Activated));
        _;
    }

    modifier withinTotalLimit() {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(poaNetworkConsensus());
        require(poa.getCurrentValidatorsLength() <= maxLimitValidators());
        _;
    }

    function isMasterOfCeremonyRemoved() public view returns(bool) {
        return boolStorage[IS_MASTER_OF_CEREMONY_REMOVED];
    }

    function maxLimitValidators() public pure returns(uint256) {
        return 2000;
    }

    function masterOfCeremony() public view returns(address) {
        return addressStorage[MASTER_OF_CEREMONY];
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

    function initialKeys(address _initialKey) public view returns(uint8) {
        return uint8(uintStorage[keccak256(INITIAL_KEYS, _initialKey)]);
    }

    function miningKeyByVoting(address _votingKey) public view returns(address) {
        return addressStorage[keccak256(MINING_KEY_BY_VOTING, _votingKey)];
    }

    function miningKeyHistory(address _miningKey) public view returns(address) {
        return addressStorage[keccak256(MINING_KEY_HISTORY, _miningKey)];
    }

    function successfulValidatorClone(address _miningKey) public view returns(bool) {
        return boolStorage[keccak256(SUCCESSFUL_VALIDATOR_CLONE, _miningKey)];
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
        address _masterOfCeremony,
        address _previousKeysManager
    ) public onlyOwner {
        require(!initDisabled());
        require(_masterOfCeremony != address(0));
        require(_masterOfCeremony != poaNetworkConsensus());
        _setMasterOfCeremony(_masterOfCeremony);
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

    function migrateMiningKey(address _miningKey) public {
        require(previousKeysManager() != address(0));
        IKeysManager previous = IKeysManager(previousKeysManager());
        require(_miningKey != address(0));
        require(previous.isMiningActive(_miningKey));
        require(!isMiningActive(_miningKey));
        require(!successfulValidatorClone(_miningKey));
        address votingKey = previous.getVotingByMining(_miningKey);
        _setVotingKey(votingKey, _miningKey);
        _setPayoutKey(previous.getPayoutByMining(_miningKey), _miningKey);
        _setIsMiningActive(previous.isMiningActive(_miningKey), _miningKey);
        _setIsVotingActive(previous.isVotingActive(votingKey), _miningKey);
        _setIsPayoutActive(previous.isPayoutActive(_miningKey), _miningKey);
        _setMiningKeyByVoting(previous.getVotingByMining(_miningKey), _miningKey);
        _setSuccessfulValidatorClone(true, _miningKey);
        address currentMiningKey = _miningKey;
        for (uint8 i = 0; i < 25; i++) {
            address oldMiningKey = previous.getMiningKeyHistory(currentMiningKey);
            if (oldMiningKey == 0) {
                break;
            }
            _setMiningKeyHistory(currentMiningKey, oldMiningKey);
            currentMiningKey = oldMiningKey;
        }
        emit Migrated("miningKey", _miningKey);
    }

    function migrateInitialKey(address _initialKey) public {
        require(initialKeys(_initialKey) == uint8(InitialKeyState.Invalid));
        require(_initialKey != address(0));
        require(previousKeysManager() != address(0));
        IKeysManager previous = IKeysManager(previousKeysManager());
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
        require(!isMasterOfCeremonyRemoved());
        require(_initialKey != address(0));
        require(initialKeys(_initialKey) == uint8(InitialKeyState.Invalid));
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
        _setVotingKey(_votingKey, _miningKey);
        _setPayoutKey(_payoutKey, _miningKey);
        _setIsMiningActive(true, _miningKey);
        _setIsVotingActive(true, _miningKey);
        _setIsPayoutActive(true, _miningKey);
        _setMiningKeyByVoting(_votingKey, _miningKey);
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
        return boolStorage[keccak256(VALIDATOR_KEYS, _key, IS_MINING_ACTIVE)];
    }

    function isVotingActive(address _votingKey) public view returns(bool) {
        address miningKey = miningKeyByVoting(_votingKey);
        return isVotingActiveByMiningKey(miningKey);
    }

    function isVotingActiveByMiningKey(address _miningKey) public view returns(bool) {
        return boolStorage[keccak256(VALIDATOR_KEYS, _miningKey, IS_VOTING_ACTIVE)];
    }

    function isPayoutActive(address _miningKey) public view returns(bool) {
        return boolStorage[keccak256(VALIDATOR_KEYS, _miningKey, IS_PAYOUT_ACTIVE)];
    }

    function getVotingByMining(address _miningKey) public view returns(address) {
        return addressStorage[keccak256(VALIDATOR_KEYS, _miningKey, VOTING_KEY)];
    }

    function getPayoutByMining(address _miningKey) public view returns(address) {
        return addressStorage[keccak256(VALIDATOR_KEYS, _miningKey, PAYOUT_KEY)];
    }

    function getMiningKeyHistory(address _miningKey) public view returns(address) {
        return miningKeyHistory(_miningKey);
    }

    function getMiningKeyByVoting(address _votingKey) public view returns(address) {
        return miningKeyByVoting(_votingKey);
    }

    function getInitialKey(address _initialKey) public view returns(uint8) {
        return initialKeys(_initialKey);
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
        _setMiningKeyHistory(_key, _oldMiningKey);
        address votingKey = getVotingByMining(_oldMiningKey);
        require(isMiningActive(_oldMiningKey));
        _setVotingKey(votingKey, _key);
        _setPayoutKey(getPayoutByMining(_oldMiningKey), _key);
        _setIsMiningActive(true, _key);
        _setIsVotingActive(isVotingActive(votingKey), _key);
        _setIsPayoutActive(isPayoutActive(_oldMiningKey), _key);
        if (_oldMiningKey == masterOfCeremony()) {
            _setMasterOfCeremony(_key);
        }
        IPoaNetworkConsensus(poaNetworkConsensus()).swapValidatorKey(_key, _oldMiningKey);
        _setVotingKey(address(0), _oldMiningKey);
        _setPayoutKey(address(0), _oldMiningKey);
        _setIsMiningActive(false, _oldMiningKey);
        _setIsVotingActive(false, _oldMiningKey);
        _setIsPayoutActive(false, _oldMiningKey);
        _setMiningKeyByVoting(votingKey, _key);
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
        address oldPayoutKey = getPayoutByMining(_miningKey);
        if (isPayoutActive(_miningKey) && oldPayoutKey != address(0)) {
            _swapPayoutKey(_key, _miningKey);
        } else {
            _setPayoutKey(_key, _miningKey);
            _setIsPayoutActive(true, _miningKey);
            emit PayoutKeyChanged(_key, _miningKey, "added");
        }
    }

    function _removeMiningKey(address _key) private {
        require(initDisabled());
        require(isMiningActive(_key));
        _setMiningKeyByVoting(getVotingByMining(_key), address(0));
        _setVotingKey(address(0), _key);
        _setPayoutKey(address(0), _key);
        _setIsMiningActive(false, _key);
        _setIsVotingActive(false, _key);
        _setIsPayoutActive(false, _key);
        if (_key == masterOfCeremony()) {
            require(initialKeysCount() >= maxNumberOfInitialKeys());
            _removeMoC();
        }
        IPoaNetworkConsensus(poaNetworkConsensus()).removeValidator(_key, true);
        emit MiningKeyChanged(_key, "removed");
    }

    function _removeMoC() private {
        boolStorage[IS_MASTER_OF_CEREMONY_REMOVED] = true;
    }

    function _removeVotingKey(address _miningKey) private {
        require(initDisabled());
        require(isVotingActiveByMiningKey(_miningKey));
        address oldVoting = getVotingByMining(_miningKey);
        _setVotingKey(address(0), _miningKey);
        _setIsVotingActive(false, _miningKey);
        _setMiningKeyByVoting(oldVoting, address(0));
        emit VotingKeyChanged(oldVoting, _miningKey, "removed");
    }

    function _removePayoutKey(address _miningKey) private {
        require(initDisabled());
        require(isPayoutActive(_miningKey));
        address oldPayout = getPayoutByMining(_miningKey);
        _setPayoutKey(address(0), _miningKey);
        _setIsPayoutActive(false, _miningKey);
        emit PayoutKeyChanged(oldPayout, _miningKey, "removed");
    }

    function _setMasterOfCeremony(address _moc) private {
        addressStorage[MASTER_OF_CEREMONY] = _moc;
    }

    function _setPreviousKeysManager(address _keysManager) private {
        addressStorage[PREVIOUS_KEYS_MANAGER] = _keysManager;
    }

    //function _setPoaNetworkConsensus(address _poa) private {
    //    addressStorage[POA_NETWORK_CONSENSUS] = _poa;
    //}

    function _setInitialKeysCount(uint256 _count) private {
        uintStorage[INITIAL_KEYS_COUNT] = _count;
    }

    function _setInitialKeyStatus(address _initialKey, uint8 _status) private {
        uintStorage[keccak256(INITIAL_KEYS, _initialKey)] = _status;
    }

    function _setVotingKey(address _key, address _miningKey) private {
        addressStorage[keccak256(VALIDATOR_KEYS, _miningKey, VOTING_KEY)] = _key;
    }

    function _setPayoutKey(address _key, address _miningKey) private {
        addressStorage[keccak256(VALIDATOR_KEYS, _miningKey, PAYOUT_KEY)] = _key;
    }

    function _setIsMiningActive(bool _active, address _miningKey) private {
        boolStorage[keccak256(VALIDATOR_KEYS, _miningKey, IS_MINING_ACTIVE)] = _active;
    }

    function _setIsVotingActive(bool _active, address _miningKey) private {
        boolStorage[keccak256(VALIDATOR_KEYS, _miningKey, IS_VOTING_ACTIVE)] = _active;
    }

    function _setIsPayoutActive(bool _active, address _miningKey) private {
        boolStorage[keccak256(VALIDATOR_KEYS, _miningKey, IS_PAYOUT_ACTIVE)] = _active;
    }

    function _setMiningKeyByVoting(address _votingKey, address _miningKey) private {
        addressStorage[keccak256(MINING_KEY_BY_VOTING, _votingKey)] = _miningKey;
    }

    function _setMiningKeyHistory(address _key, address _oldMiningKey) private {
        addressStorage[keccak256(MINING_KEY_HISTORY, _key)] = _oldMiningKey;
    }

    function _setSuccessfulValidatorClone(bool _success, address _miningKey) private {
        boolStorage[keccak256(SUCCESSFUL_VALIDATOR_CLONE, _miningKey)] = _success;
    }
}
