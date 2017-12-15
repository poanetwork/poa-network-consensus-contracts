pragma solidity ^0.4.18;

import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";


contract KeysManager is IKeysManager {
    enum InitialKeyState { Invalid, Activated, Deactivated }

    struct Keys {
        address votingKey;
        address payoutKey;
        bool isMiningActive;
        bool isVotingActive;
        bool isPayoutActive;
    }
    
    address public masterOfCeremony;
    IProxyStorage public proxyStorage;
    
    IPoaNetworkConsensus public poaNetworkConsensus;
    uint256 public maxNumberOfInitialKeys = 12;
    uint256 public initialKeysCount = 0;
    uint256 public maxLimitValidators = 2000;
    mapping(address => uint8) public initialKeys;
    mapping(address => Keys) public validatorKeys;
    mapping(address => address) public miningKeyByVoting;
    mapping(address => address) public miningKeyHistory;

    event PayoutKeyChanged(address key, address indexed miningKey, string action);
    event VotingKeyChanged(address key, address indexed miningKey, string action);
    event MiningKeyChanged(address key, string action);
    event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
    event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);

    modifier onlyVotingToChangeKeys() {
        require(msg.sender == getVotingToChangeKeys());
        _;
    }

    modifier onlyValidInitialKey() {
        require(initialKeys[msg.sender] == uint8(InitialKeyState.Activated));
        _;
    }

    modifier withinTotalLimit() {
        require(poaNetworkConsensus.getCurrentValidatorsLength() <= maxLimitValidators);
        _;
    }

    function KeysManager(address _proxyStorage, address _poaConsensus, address _masterOfCeremony) public {
        require(_proxyStorage != address(0) && _poaConsensus != address(0));
        require(_proxyStorage != _poaConsensus);
        require(_masterOfCeremony != address(0) && _masterOfCeremony != _poaConsensus);
        masterOfCeremony = _masterOfCeremony;
        proxyStorage = IProxyStorage(_proxyStorage);
        poaNetworkConsensus = IPoaNetworkConsensus(_poaConsensus);
        validatorKeys[masterOfCeremony] = Keys({
            votingKey: address(0),
            payoutKey: address(0),
            isMiningActive: true,
            isVotingActive: false,
            isPayoutActive: false
        });
    }

    function initiateKeys(address _initialKey) public {
        require(msg.sender == masterOfCeremony);
        require(_initialKey != address(0));
        require(initialKeys[_initialKey] == uint8(InitialKeyState.Invalid));
        require(_initialKey != masterOfCeremony);
        require(initialKeysCount < maxNumberOfInitialKeys);
        initialKeys[_initialKey] = uint8(InitialKeyState.Activated);
        initialKeysCount++;
        InitialKeyCreated(_initialKey, getTime(), initialKeysCount);
    }

    function createKeys(address _miningKey, address _votingKey, address _payoutKey) public onlyValidInitialKey {
        require(_miningKey != address(0) && _votingKey != address(0) && _payoutKey != address(0));
        require(_miningKey != _votingKey && _miningKey != _payoutKey && _votingKey != _payoutKey);
        require(_miningKey != msg.sender && _votingKey != msg.sender && _payoutKey != msg.sender);
        validatorKeys[_miningKey] = Keys({
            votingKey: _votingKey,
            payoutKey: _payoutKey,
            isMiningActive: true,
            isVotingActive: true,
            isPayoutActive: true
        });
        miningKeyByVoting[_votingKey] = _miningKey;
        initialKeys[msg.sender] = uint8(InitialKeyState.Deactivated);
        poaNetworkConsensus.addValidator(_miningKey);
        ValidatorInitialized(_miningKey, _votingKey, _payoutKey);
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function getVotingToChangeKeys() public view returns(address) {
        return proxyStorage.getVotingToChangeKeys();
    }

    function isMiningActive(address _key) public view returns(bool) {
        return validatorKeys[_key].isMiningActive;
    }

    function isVotingActive(address _votingKey) public view returns(bool) {
        address miningKey = miningKeyByVoting[_votingKey];
        return validatorKeys[miningKey].isVotingActive;
    }

    function isPayoutActive(address _miningKey) public view returns(bool) {
        return validatorKeys[_miningKey].isPayoutActive;
    }

    function getVotingByMining(address _miningKey) public view returns(address) {
        return validatorKeys[_miningKey].votingKey;
    }

    function getPayoutByMining(address _miningKey) public view returns(address) {
        return validatorKeys[_miningKey].payoutKey;
    }

    function getMiningKeyHistory(address _miningKey) public view returns(address) {
        return miningKeyHistory[_miningKey];
    }

    function getMiningKeyByVoting(address _miningKey) public view returns(address) {
        return miningKeyByVoting[_miningKey];
    }

    function getInitialKey(address _initialKey) public view returns(uint8) {
        return initialKeys[_initialKey];
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

    function swapMiningKey(address _key, address _oldMiningKey) public onlyVotingToChangeKeys {
        miningKeyHistory[_key] = _oldMiningKey;
        _removeMiningKey(_oldMiningKey);
        _addMiningKey(_key);
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
        validatorKeys[_key] = Keys({
            votingKey: address(0),
            payoutKey: address(0),
            isVotingActive: false,
            isPayoutActive: false,
            isMiningActive: true
        });
        poaNetworkConsensus.addValidator(_key);
        MiningKeyChanged(_key, "added");
    }

    function _addVotingKey(address _key, address _miningKey) private {
        Keys storage validator = validatorKeys[_miningKey];
        require(validator.isMiningActive && _key != _miningKey);
        if (validator.isVotingActive) {
            _swapVotingKey(_key, _miningKey);
        } else {
            validator.votingKey = _key;
            validator.isVotingActive = true;
            miningKeyByVoting[_key] = _miningKey;
            VotingKeyChanged(_key, _miningKey, "added");
        }
    }

    function _addPayoutKey(address _key, address _miningKey) private {
        Keys storage validator = validatorKeys[_miningKey];
        require(validator.isMiningActive && _key != _miningKey);
        if (validator.isPayoutActive && validator.payoutKey != address(0)) {
            _swapPayoutKey(_key, _miningKey);
        } else {
            validator.payoutKey = _key;
            validator.isPayoutActive = true;
            PayoutKeyChanged(_key, _miningKey, "added");
        }
    }

    function _removeMiningKey(address _key) private {
        require(validatorKeys[_key].isMiningActive);
        Keys memory keys = validatorKeys[_key];
        miningKeyByVoting[keys.votingKey] = address(0);
        validatorKeys[_key] = Keys({
            votingKey: address(0),
            payoutKey: address(0),
            isVotingActive: false,
            isPayoutActive: false,
            isMiningActive: false
        });
        poaNetworkConsensus.removeValidator(_key);
        MiningKeyChanged(_key, "removed");
    }

    function _removeVotingKey(address _miningKey) private {
        Keys storage validator = validatorKeys[_miningKey];
        require(validator.isVotingActive);
        address oldVoting = validator.votingKey;
        validator.votingKey = address(0);
        validator.isVotingActive = false;
        miningKeyByVoting[oldVoting] = address(0);
        VotingKeyChanged(oldVoting, _miningKey, "removed");
    }

    function _removePayoutKey(address _miningKey) private {
        Keys storage validator = validatorKeys[_miningKey];
        require(validator.isPayoutActive);
        address oldPayout = validator.payoutKey;
        validator.payoutKey = address(0);
        validator.isPayoutActive = false;
        PayoutKeyChanged(oldPayout, _miningKey, "removed");
    }
}