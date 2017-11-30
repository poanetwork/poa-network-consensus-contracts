import "./voting/Voting.sol";
import "./KeysManager.sol";

pragma solidity ^0.4.18;

contract BallotsManager {
  enum BallotTypes {Invalid, Adding, Removal, Swap}
  enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}
  struct Ballot {
    bool isActive;
    address affectedKey;
    uint256 affectedKeyType;
    address miningKey;
    uint256 ballotType;
    uint256 index;
  }
  KeysManager public keysManager;
  PoaNetworkConsensus public poaNetworkConsensus;
  mapping(address => Ballot) public ballotState; 
  address[] public activeBallots;
  uint256 public maxNumberOfBallots = 2000;
  uint256 public activeBallotsLength;

  modifier onlyVotingContract(address ballot) {
    require(ballotState[ballot].isActive);
    _;
  }

  modifier onlyVotingKey(address _key) {
    require(keysManager.votingKeys(_key));
    _;
  }

  modifier onlyValidBallotType(uint256 _ballotType) {
    require(_ballotType > uint256(BallotTypes.Invalid) && _ballotType <= uint256(BallotTypes.Swap));
    _;
  }
  function BallotsManager(address _poaConsensus) {
    PoaNetworkConsensus poaNetworkConsensus = PoaNetworkConsensus(_poaConsensus);
    keysManager = KeysManager(poaNetworkConsensus.keysManager());
  }

  function createBallot(
    uint256 _startTime,
    uint256 _endTime,
    address _affectedKey,
    uint256 _affectedKeyType,
    address _miningKey,
    uint256 _ballotType
    ) public onlyVotingKey(msg.sender) onlyValidBallotType(_ballotType) returns(address newBallotId)
  {
    require(_affectedKeyType > 0);
    require(_affectedKey != address(0));
    require(activeBallots.length <= 100);
    if(_miningKey != address(0)){
      require(_affectedKey != _miningKey);
      require(keysManager.isMiningActive(_miningKey));
    }
    address id = deployVotingContract(_startTime, _endTime);
    ballotState[id] = Ballot({
      isActive: true,
      affectedKey: _affectedKey,
      affectedKeyType: _affectedKeyType,
      miningKey: _miningKey,
      ballotType: _ballotType,
      index: activeBallots.length
    });
    activeBallots.push(id);
    activeBallotsLength = activeBallots.length;
    newBallotId = id;
  }

  function finalize(address id, int _progress) public onlyVotingContract(id) {
    Ballot storage ballot = ballotState[id];
    if(_progress > 0) {
      if(ballot.ballotType == uint256(BallotTypes.Adding)) {
        finalizeAdding(id);
      } else if(ballot.ballotType == uint256(BallotTypes.Removal)) {
        finalizeRemoval(id);
      } else if(ballot.ballotType == uint256(BallotTypes.Swap)) {
        finalizeSwap(id);
      }
    }
    ballot.isActive = false;
    delete activeBallots[ballot.index];
    if(activeBallots.length > 0){
      activeBallots.length--;
    }
    activeBallotsLength = activeBallots.length;
  }

  function finalizeAdding(address id) private {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Adding));
    if(ballot.affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.addMiningKey(ballot.affectedKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.addVotingKey(ballot.affectedKey, ballot.miningKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.addPayoutKey(ballot.affectedKey, ballot.miningKey);
    }
  }

  function finalizeRemoval(address id) private {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Removal));
    if(ballot.affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.removeMiningKey(ballot.affectedKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.removeVotingKey(ballot.miningKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.removePayoutKey(ballot.miningKey);
    }
  }

  function finalizeSwap(address id) private {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Swap));
    if(ballot.affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.swapMiningKey(ballot.affectedKey, ballot.miningKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.swapVotingKey(ballot.affectedKey, ballot.miningKey);
    }
    if(ballot.affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.swapPayoutKey(ballot.affectedKey, ballot.miningKey);
    }
  }

  function deployVotingContract(uint256 _startTime, uint256 _endTime) private returns(address) {
    return new Voting(_startTime, _endTime, address(keysManager));
  }
}
