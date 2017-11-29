import "zeppelin-solidity/contracts/ownership/Claimable.sol";
import "./PoaNetworkConsensus.sol";
pragma solidity ^0.4.18;

contract KeysManager is Claimable {
  struct Keys {
    address votingKey;
    address payoutKey;
    bool isVotingActive;
    bool isPayoutActive;
    bool isMiningActive;
  }
  // TODO: Please hardcode address for master of ceremony
  address public masterOfCeremony;
  address public ballotsManager;
  
  PoaNetworkConsensus public poaNetworkConsensus;
  uint256 public maxNumberOfInitialKeys = 12;
  uint256 public initialKeysCount = 0;
  mapping(address => bool) public initialKeys;
  mapping(address => Keys) public validatorKeys;
  mapping(address => bool) public votingKeys;

  event PayoutKeyChanged(address key, address indexed miningKey, string action);
  event VotingKeyChanged(address key, address indexed miningKey, string action);
  event MiningKeyChanged(address key, string action);
  event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
  event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);

  modifier onlyBallotsManager(){
    require(msg.sender == ballotsManager);
    _;
  }

  modifier onlyValidInitialKey {
    require(initialKeys[msg.sender]);
    _;
  }

  function KeysManager() {
    owner = masterOfCeremony;
    ballotsManager = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
    poaNetworkConsensus = PoaNetworkConsensus(0x0039F22efB07A647557C7C5d17854CFD6D489eF3);
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
    votingKeys[_votingKey] = true;
    initialKeys[msg.sender] = false;
    poaNetworkConsensus.addValidator(_miningKey);
    ValidatorInitialized(_miningKey, _votingKey, _payoutKey);
  }

  function isMiningActive(address _key) public view returns(bool) {
    return validatorKeys[_key].isMiningActive;
  }

  function isVotingActive(address _key) public view returns(bool) {
    return votingKeys[_key];
  }

  function isPayoutActive(address _miningKey) public view returns(bool) {
    return validatorKeys[_miningKey].isPayoutActive;
  }

  function addMiningKey(address _key) public onlyBallotsManager {
    _addMiningKey(_key);
  }

  function addVotingKey(address _key, address _miningKey) public onlyBallotsManager {
    _addVotingKey(_key, _miningKey);
  }

  function addPayoutKey(address _key, address _miningKey) public onlyBallotsManager {
    _addPayoutKey(_key, _miningKey);
  }

  function removeMiningKey(address _key) public onlyBallotsManager {
    _removeMiningKey(_key);
  }

  function removeVotingKey(address _miningKey) public onlyBallotsManager {
    _removeVotingKey(_miningKey);
  }

  function removePayoutKey(address _miningKey) public onlyBallotsManager {
    _removePayoutKey(_miningKey);
  }

  function swapMiningKey(address _key, address _oldMiningKey) public onlyBallotsManager {
    _removeMiningKey(_oldMiningKey);
    _addMiningKey(_key);
  }

  function swapVotingKey(address _key, address _miningKey) public onlyBallotsManager {
    _removeVotingKey(_miningKey);
    _addVotingKey(_key, _miningKey);
  }

  function swapPayoutKey(address _key, address _miningKey) public onlyBallotsManager {
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
    validator.votingKey = _key;
    validator.isVotingActive = true;
    votingKeys[_key] = true;
    VotingKeyChanged(_key, _miningKey, "added");
  }

  function _addPayoutKey(address _key, address _miningKey) private {
    Keys storage validator = validatorKeys[_miningKey];
    validator.payoutKey = _key;
    validator.isPayoutActive = true;
    PayoutKeyChanged(_key, _miningKey, "added");
  }

  function _removeMiningKey(address _key) private {
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
    address oldVoting = validator.votingKey;
    validator.votingKey = address(0);
    validator.isVotingActive = false;
    votingKeys[oldVoting] = false;
    VotingKeyChanged(oldVoting, _miningKey, "removed");
  }

  function _removePayoutKey(address _miningKey) private {
    Keys storage validator = validatorKeys[_miningKey];
    address oldPayout = validator.payoutKey;
    validator.payoutKey = address(0);
    validator.isPayoutActive = false;
    PayoutKeyChanged(oldPayout, _miningKey, "removed");
  }

  function getTime() public view returns(uint256) {
    return now;
  }
}