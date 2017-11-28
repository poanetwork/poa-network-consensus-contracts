import "zeppelin-solidity/contracts/ownership/Claimable.sol";
pragma solidity ^0.4.18;

contract KeysManager is Claimable {
  // TODO: Please hardcode address for master of ceremony
  address public masterOfCeremony;
  uint256 public maxNumberOfInitialKeys = 12;
  uint256 public initialKeysCount = 0;
  mapping(address => bool) public initialKeys;
  mapping(address => bool) public miningKeys;
  mapping(address => bool) public votingKeys;
  mapping(address => bool) public payoutKeys;

  event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
  event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);

  modifier onlyValidInitialKey {
    require(initialKeys[msg.sender]);
    _;
  }

  function KeysManager() {
    owner = masterOfCeremony;
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
    miningKeys[_miningKey] = true;
    votingKeys[_votingKey] = true;
    payoutKeys[_payoutKey] = true;  
    initialKeys[msg.sender] = false;
    ValidatorInitialized(_miningKey, _votingKey, _payoutKey);
  }

  function getTime() public view returns(uint256) {
    return now;
  }

}