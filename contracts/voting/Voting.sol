import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "../PoaNetworkConsensus.sol";
import "../BallotsManager.sol";
import "../KeysManager.sol";
pragma solidity ^0.4.18;

contract Voting { 
  using SafeMath for uint256;
  int public progress;
  uint256 public startTime = 0;
  uint256 public endTime = 0;
  uint256 public totalVoters;
  bool public isFinalized = false;
  address public affectedKey;
  address public miningKey;
  KeysManager public keysManager;
  BallotsManager public ballotsManager;
  mapping(address => bool) public voters;
  uint8 public maxOldMiningKeysDeepCheck = 25;

  event Vote(uint256 indexed decision, address indexed voter, uint256 time );
  event Finalized(address indexed voter);
  event Created(uint256 _startTime, uint256 _endTime);

  enum ActionChoice { Invalid, Accept, Reject }

  modifier onlyValidVotingKey(address _votingKey) {
    require(keysManager.isVotingActive(_votingKey));
    _;
  }

  function Voting(uint256 _startTime, uint256 _endTime, address _keysContract) {
    require(_startTime > 0 && _endTime > 0);
    require(_endTime > _startTime && _startTime > getTime());
    require(_keysContract != msg.sender);
    keysManager = KeysManager(_keysContract);
    ballotsManager = BallotsManager(msg.sender);

    startTime = _startTime;
    endTime = _endTime;
    Created(startTime, endTime);
  }

  function vote(uint8 choice) public onlyValidVotingKey(msg.sender) {
    address miningKey = getMiningByVotingKey(msg.sender);
    require(isValidVote(miningKey));
    if(choice == uint(ActionChoice.Accept)){
      progress++;
    } else if(choice == uint(ActionChoice.Reject)){
      progress--;
    } else {
      revert();
    }
    totalVoters++;
    voters[miningKey] = true;
    Vote(choice, msg.sender, getTime());
  }

  function finalize() public onlyValidVotingKey(msg.sender) {
    require(!isActive());
    ballotsManager.finalize(address(this), progress, totalVoters);
    isFinalized = true;
    Finalized(msg.sender);
  }

  function getTime() public view returns(uint256) {
    return now;
  }

  function isActive() public view returns(bool) {
    bool withinTime = startTime <= getTime() && getTime() <= endTime;
    return withinTime && !isFinalized;
  }

  function isValidVote(address _sender) public view returns(bool) {
    bool notVoted = !voters[_sender];
    bool oldKeysNotVoted = !areOldMiningKeysVoted(_sender);
    return notVoted && isActive() && oldKeysNotVoted;
  }

  function areOldMiningKeysVoted(address _miningKey) public view returns(bool) {
    for(uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
      address oldMiningKey = keysManager.miningKeyHistory(_miningKey);
      if(oldMiningKey == address(0)){
        return false;
      }
      if(voters[oldMiningKey]) {
        return true;
      } else {
        _miningKey = oldMiningKey;
      }
    }
    return false;
  }

  function getMiningByVotingKey(address _votingKey) public view returns(address) {
    return keysManager.getMiningKeyByVoting(_votingKey);
  }

}
