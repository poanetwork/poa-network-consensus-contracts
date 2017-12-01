pragma solidity ^0.4.18;

contract BallotsStorage {
  enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
  struct Ballot {
    uint256 ballotType;
    uint256 index;
    uint256 minThresholdOfVoters;
    uint256 quorumState;
  }
  address[] public activeBallots;
  uint256 public maxNumberOfBallots = 2000;
  uint256 public activeBallotsLength;
  uint256 public minThresholdOfVoters = 3;
  address public ballotsManager;
  mapping(address => Ballot) public ballotState;  

  modifier onlyBallotsManager() {
    require(msg.sender == ballotsManager);
    _;
  }

  function BallotsStorage(address _ballotsManager) {
    require(_ballotsManager != address(0));
    ballotsManager = _ballotsManager;
  }

  function addBallot(address id, uint256 _ballotType) public onlyBallotsManager {
    ballotState[id] = Ballot({
      ballotType: _ballotType,
      index: activeBallots.length,
      minThresholdOfVoters: minThresholdOfVoters,
      quorumState: uint8(QuorumStates.InProgress)
    });
    activeBallots.push(id);
    activeBallotsLength = activeBallots.length;
  }

  function updateBallot(address id, uint256 _quorumState) public onlyBallotsManager {
    Ballot storage ballot = ballotState[id];
    ballot.quorumState = _quorumState;
  }

  function deactiveBallot(address id) public onlyBallotsManager {
    Ballot memory ballot = ballotState[id];
    delete activeBallots[ballot.index];
    if(activeBallots.length > 0){
      activeBallots.length--;
    }
    activeBallotsLength = activeBallots.length;
  }

  function isCurrentBallotInProgress(address id) public view returns(bool) {
    return ballotState[id].quorumState == uint8(QuorumStates.InProgress);
  }

  function getMinThresholdOfVoters(address id) public view returns(uint256) {
    return ballotState[id].minThresholdOfVoters;
  }

  function getBallotType(address id) public view returns(uint256) {
    return ballotState[id].ballotType;
  }
  // function removeBallot()

}