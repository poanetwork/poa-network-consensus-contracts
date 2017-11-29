import "./voting/VotingForAdding.sol";
import "./KeysManager.sol";

pragma solidity ^0.4.18;

contract BallotsManager {
  enum BallotTypes {Adding, Removal, Swap}
  enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}
  struct Ballot {
    bool isActive;
    address affectedKey;
    uint256 affectedKeyType;
    address miningKey;
    uint256 ballotType;
  }
  KeysManager public keysManager;
  mapping(address => Ballot) public ballotState; 

  modifier onlyVotingContract(address ballot) {
    require(ballotState[ballot].isActive);
    _;
  }
  function BallotsManager() {
    PoaNetworkConsensus poaNetworkConsensus = PoaNetworkConsensus(0x0039F22efB07A647557C7C5d17854CFD6D489eF3);
    keysManager = KeysManager(poaNetworkConsensus.keysManager());
  }

  function createBallotToAddKey(uint256 _startTime, uint256 _endTime, address _affectedKey, uint256 _affectedKeyType, address _miningKey) {
    require(_affectedKeyType > 0);
    require(_affectedKey != address(0));
    if(_miningKey != address(0)){
      require(_affectedKey != _miningKey);
      require(keysManager.isMiningActive(_miningKey));
    }
    address id = new VotingForAdding(_startTime, _endTime);
    ballotState[id] = Ballot({
      isActive: true,
      affectedKey: _affectedKey,
      affectedKeyType: _affectedKeyType,
      miningKey: _miningKey,
      ballotType: uint256(BallotTypes.Adding)
    });
  }

  function createBallotToRemoveKey(uint256 _startTime, uint256 _endTime, address _affectedKey, uint256 _affectedKeyType, address _miningKey) {
    require(_affectedKeyType > 0);
    require(_affectedKey != address(0));
    if(_miningKey != address(0)){
      require(_affectedKey != _miningKey);
      require(keysManager.isMiningActive(_miningKey));
    }
    address id = new VotingForAdding(_startTime, _endTime);
    ballotState[id] = Ballot({
      isActive: true,
      affectedKey: _affectedKey,
      affectedKeyType: _affectedKeyType,
      miningKey: _miningKey,
      ballotType: uint256(BallotTypes.Removal)
    });
  }

  function createBallotToSwapKey(uint256 _startTime, uint256 _endTime, address _affectedKey, uint256 _affectedKeyType, address _miningKey) {
    require(_affectedKeyType > 0);
    require(_affectedKey != address(0));
    if(_miningKey != address(0)){
      require(_affectedKey != _miningKey);
      require(keysManager.isMiningActive(_miningKey));
    }
    address id = new VotingForAdding(_startTime, _endTime);
    ballotState[id] = Ballot({
      isActive: true,
      affectedKey: _affectedKey,
      affectedKeyType: _affectedKeyType,
      miningKey: _miningKey,
      ballotType: uint256(BallotTypes.Swap)
    });
  }

  function finalizeAdding(address id, int _progress) public onlyVotingContract(id) {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Adding));
    if(_progress > 0){
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
    ballot.isActive = false;
  }

  function finalizeRemoval(address id, int _progress) public onlyVotingContract(id) {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Removal));
    if(_progress > 0){
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
    ballot.isActive = false;
  }

  function finalizeSwap(address id, int _progress) public onlyVotingContract(id) {
    Ballot storage ballot = ballotState[id];
    require(ballot.ballotType == uint256(BallotTypes.Swap));
    if(_progress > 0){
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
    ballot.isActive = false;
  }
}
