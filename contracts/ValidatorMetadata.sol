pragma solidity ^0.4.18;
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./KeysManager.sol";
import "./BallotsStorage.sol";

contract ValidatorMetadata {
  using SafeMath for uint256;
  struct Validator {
      bytes32 firstName;
      bytes32 lastName;
      bytes32 licenseId;
      bytes32 state;
      uint256 zipcode;
      uint256 expirationDate;
      uint256 createdDate;
      uint256 updatedDate;
      uint256 minThreshold;
  }
  KeysManager public keysManager;
  BallotsStorage public ballotsStorage;
  event MetadataCreated(address indexed miningKey);
  event ChangeRequestInitiated(address indexed miningKey);
  event Confirmed(address indexed miningKey, address votingSender);
  event FinalizedChange(address indexed miningKey);
  mapping(address => Validator) public validators;
  mapping(address => Validator) public pendingChanges;
  mapping(address => uint256) public confirmations;

  modifier onlyValidVotingKey(address _votingKey) {
      require(keysManager.isVotingActive(_votingKey));
      _;
  }

  modifier onlyFirstTime(address _votingKey) {
      address miningKey = getMiningByVotingKey(msg.sender);
      Validator storage validator = validators[miningKey];
      require(validator.createdDate == 0);
      _;
  }

  function ValidatorMetadata(address _keysContract, address _ballotsStorage) public {
      keysManager = KeysManager(_keysContract);
      ballotsStorage = BallotsStorage(_ballotsStorage);
  }

  function createMetadata(
      uint256 _zipcode,
      bytes32 _firstName,
      bytes32 _lastName,
      bytes32 _licenseId,
      uint256 _expirationDate,
      bytes32 _state
  ) public onlyValidVotingKey(msg.sender) onlyFirstTime(msg.sender)
  {
    Validator memory validator = Validator({
      zipcode: _zipcode,
      firstName: _firstName,
      lastName: _lastName,
      licenseId: _licenseId,
      expirationDate: _expirationDate,
      state: _state,
      createdDate: getTime(),
      updatedDate: 0,
      minThreshold: getMinThreshold()
    });
    address miningKey = getMiningByVotingKey(msg.sender);
    validators[miningKey] = validator;
    MetadataCreated(miningKey);
  }

  function changeRequest(
      uint256 _zipcode,
      bytes32 _firstName,
      bytes32 _lastName,
      bytes32 _licenseId,
      uint256 _expirationDate,
      bytes32 _state
  ) public onlyValidVotingKey(msg.sender) returns(bool) {
    address miningKey = getMiningByVotingKey(msg.sender);
    Validator memory pendingChange = Validator({
      zipcode: _zipcode,
      firstName: _firstName,
      lastName: _lastName,
      licenseId: _licenseId,
      expirationDate: _expirationDate,
      state: _state,
      createdDate: validators[miningKey].createdDate,
      updatedDate: getTime(),
      minThreshold: validators[miningKey].minThreshold
    });
    pendingChanges[miningKey] = pendingChange;
    ChangeRequestInitiated(miningKey);
    return true;
  }

  function cancelPendingChange() public onlyValidVotingKey(msg.sender) returns(bool) {
    address miningKey = getMiningByVotingKey(msg.sender);
    delete pendingChanges[miningKey];
    return true;
  }

  function confirmPendingChange(address _miningKey) public onlyValidVotingKey(msg.sender) {
    address miningKey = getMiningByVotingKey(msg.sender);
    require(miningKey != _miningKey);
    confirmations[_miningKey] = confirmations[_miningKey].add(1);
    Confirmed(_miningKey, msg.sender);
  }

  function finalize(address _miningKey) public onlyValidVotingKey(msg.sender) {
    require(confirmations[_miningKey] >= pendingChanges[_miningKey].minThreshold);
    validators[_miningKey] = pendingChanges[_miningKey];
    delete pendingChanges[_miningKey];
    FinalizedChange(_miningKey);
  }

  function getMiningByVotingKey(address _votingKey) public view returns(address) {
    return keysManager.getMiningKeyByVoting(_votingKey);
  }

  function getTime() public view returns(uint256) {
    return now;
  }

  function getMinThreshold() public view returns(uint256) {
    uint8 thresholdType = 2;
    return ballotsStorage.ballotThresholds(thresholdType);
  }

}