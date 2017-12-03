pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Claimable.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./interfaces/IKeysManager.sol";

contract KeysManager is Claimable, IKeysManager {
    struct Keys {
        address votingKey;
        address payoutKey;
        bool isMiningActive;
        bool isVotingActive;
        bool isPayoutActive;
    }
    // TODO: Please hardcode address for master of ceremony
    address public masterOfCeremony = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
    address public votingContract;
    
    IPoaNetworkConsensus public poaNetworkConsensus;
    uint256 public maxNumberOfInitialKeys = 12;
    uint256 public initialKeysCount = 0;
    uint256 public maxLimitValidators = 2000;
    mapping(address => bool) public initialKeys;
    mapping(address => Keys) public validatorKeys;
    mapping(address => address) public getMiningKeyByVoting;
    mapping(address => address) public miningKeyHistory;

    event PayoutKeyChanged(address key, address indexed miningKey, string action);
    event VotingKeyChanged(address key, address indexed miningKey, string action);
    event MiningKeyChanged(address key, string action);
    event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
    event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);

    modifier onlyVotingContract() {
        require(msg.sender == votingContract);
        _;
    }

    modifier onlyValidInitialKey() {
        require(initialKeys[msg.sender]);
        _;
    }

    modifier withinTotalLimit() {
        require(poaNetworkConsensus.currentValidatorsLength() <= maxLimitValidators);
        _;
    }

    function KeysManager(address _votingContract, address _poaConsensus) public {
        require(_votingContract != address(0) && _poaConsensus != address(0));
        require(_votingContract != _poaConsensus);
        owner = masterOfCeremony;
        votingContract = _votingContract;
        poaNetworkConsensus = IPoaNetworkConsensus(_poaConsensus);
    }

    function initiateKeys(address _initialKey) public onlyOwner {
        require(_initialKey != address(0));
        require(!initialKeys[_initialKey]);
        require(_initialKey != owner);
        require(initialKeysCount < maxNumberOfInitialKeys);
        initialKeys[_initialKey] = true;
        initialKeysCount++;
        InitialKeyCreated(_initialKey, getTime(), initialKeysCount);
    }

    function createKeys(address _miningKey, address _votingKey, address _payoutKey) public onlyValidInitialKey {
        require(_miningKey != _votingKey && _miningKey != _payoutKey && _votingKey != _payoutKey);
        require(_miningKey != msg.sender && _votingKey != msg.sender && _payoutKey != msg.sender);
        validatorKeys[_miningKey] = Keys({
            votingKey: _votingKey,
            payoutKey: _payoutKey,
            isVotingActive: true,
            isPayoutActive: true,
            isMiningActive: true
        });
        getMiningKeyByVoting[_votingKey] = _miningKey;
        initialKeys[msg.sender] = false;
        poaNetworkConsensus.addValidator(_miningKey);
        ValidatorInitialized(_miningKey, _votingKey, _payoutKey);
    }

    function isMiningActive(address _key) public view returns(bool) {
        return validatorKeys[_key].isMiningActive;
    }

    function isVotingActive(address _votingKey) public view returns(bool) {
        address miningKey = getMiningKeyByVoting[_votingKey];
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

    function addMiningKey(address _key) public onlyVotingContract withinTotalLimit {
        _addMiningKey(_key);
    }

    function addVotingKey(address _key, address _miningKey) public onlyVotingContract {
        _addVotingKey(_key, _miningKey);
    }

    function addPayoutKey(address _key, address _miningKey) public onlyVotingContract {
        _addPayoutKey(_key, _miningKey);
    }

    function removeMiningKey(address _key) public onlyVotingContract {
        _removeMiningKey(_key);
    }

    function removeVotingKey(address _miningKey) public onlyVotingContract {
        _removeVotingKey(_miningKey);
    }

    function removePayoutKey(address _miningKey) public onlyVotingContract {
        _removePayoutKey(_miningKey);
    }

    function swapMiningKey(address _key, address _oldMiningKey) public onlyVotingContract {
        miningKeyHistory[_key] = _oldMiningKey;
        _removeMiningKey(_oldMiningKey);
        _addMiningKey(_key);
    }

    function swapVotingKey(address _key, address _miningKey) public onlyVotingContract {
        _swapVotingKey(_key, _miningKey);
    }

    function swapPayoutKey(address _key, address _miningKey) public onlyVotingContract {
        _swapPayoutKey(_key, _miningKey);
    }

    function getTime() public view returns(uint256) {
        return now;
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
            getMiningKeyByVoting[_key] = _miningKey;
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
        getMiningKeyByVoting[keys.votingKey] = address(0);
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
        getMiningKeyByVoting[_miningKey] = address(0);
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

    // function setVotingContract(address _votingContract) public onlyBallotProxy {

    // }
}