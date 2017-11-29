import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "../PoaNetworkConsensus.sol";
import "../BallotsManager.sol";
import "../KeysManager.sol";
pragma solidity ^0.4.18;

contract VotingForAdding { 
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

  event Vote(uint256 indexed decision, address indexed voter, uint256 time );
  event Finalized(address indexed voter);

  enum ActionChoice { Invalid, Accept, Reject }

  modifier onlyValidVotingKey(address _votingKey) {
    require(keysManager.votingKeys(_votingKey));
    _;
  }

  function VotingForAdding(uint256 _startTime, uint256 _endTime) {
    require(_startTime > 0 && _endTime > 0);
    require(_endTime > _startTime && _startTime > getTime());
    PoaNetworkConsensus poaNetworkConsensus = PoaNetworkConsensus(0x0039F22efB07A647557C7C5d17854CFD6D489eF3);
    keysManager = KeysManager(poaNetworkConsensus.keysManager());
    ballotsManager = BallotsManager(poaNetworkConsensus.ballotsManager());

    startTime = _startTime;
    endTime = _endTime;
  }

  function vote(uint8 choice) public onlyValidVotingKey(msg.sender) {
    require(isValidVote(msg.sender));
    if(choice == uint(ActionChoice.Accept)){
      progress++;
    } else if(choice == uint(ActionChoice.Reject)){
      progress--;
    } else {
      revert();
    }
    totalVoters++;
    Vote(choice, msg.sender, getTime());
  }

  function finalize() public onlyValidVotingKey(msg.sender) {
    require(!isActive());
    ballotsManager.finalizeAdding(this, progress);
    isFinalized = true;
    Finalized(msg.sender);
  }

  function getTime() public view returns(uint256) {
    return now;
  }

  function isActive() public view returns(bool) {
    bool withinTime = startTime < getTime() && getTime() < endTime;
    return withinTime;
  }

  function isValidVote(address _sender) public view returns(bool) {
    bool notVoted = !voters[_sender];
    return notVoted && !isFinalized && isActive();
  }

}
