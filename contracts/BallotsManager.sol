pragma solidity ^0.4.18;
import "./voting/VotingKeys.sol";
import "./KeysManager.sol";
import "./BallotsStorage.sol";
import "./voting/VotingChangeMinThreshold.sol";

contract BallotsManager {
  enum BallotTypes {Invalid, Adding, Removal, Swap, ChangeMinThreshold}
  enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}
  enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
  struct Ballot {
    uint256 ballotType;
    uint256 index;
    uint256 minThresholdOfVoters;
    uint256 quorumState;
  }
  KeysManager public keysManager;
  BallotsStorage public ballotsStorage;
  mapping(address => Ballot) public ballotState;
  address public deployer;

  event BallotCreated(address indexed _ballotId);
  event BallotFinalized(address indexed _ballotId);

  modifier onlyVotingContract(address ballot) {
    require(ballotsStorage.isCurrentBallotInProgress(ballot));
    _;
  }

  modifier onlyVotingKey(address _key) {
    require(keysManager.isVotingActive(_key));
    _;
  }

  modifier onlyValidBallotType(uint256 _ballotType) {
    require(_ballotType > uint256(BallotTypes.Invalid) && _ballotType <= uint256(BallotTypes.Swap));
    _;
  }
  function BallotsManager(address _keysManager, address _ballotsStorage) {
    keysManager = KeysManager(_keysManager);
    ballotsStorage = BallotsStorage(_ballotsStorage);
  }

  function createChangeMinimumThreshold(
    uint256 _startTime,
    uint256 _endTime,
    uint256 _ballotType,
    uint256 _proposedValue
  ) public onlyVotingKey(msg.sender)
  {
    require(_ballotType == uint256(BallotTypes.ChangeMinThreshold));
    require(_proposedValue > 0);
    address id = deployThreshold(_startTime, _endTime, _proposedValue);
    ballotsStorage.addBallot(id, _ballotType);
    BallotCreated(id);
  }

  function createKeysBallot(
    uint256 _startTime,
    uint256 _endTime,
    address _affectedKey,
    uint256 _affectedKeyType,
    address _miningKey,
    uint256 _ballotType
    ) public onlyVotingKey(msg.sender) onlyValidBallotType(_ballotType)
  {
    require(_affectedKeyType > 0);
    require(_affectedKey != address(0));
    require(ballotsStorage.activeBallotsLength() <= 100);
    require(AreBallotParamsValid(_ballotType, _affectedKey, _affectedKeyType, _miningKey)); //only if ballotType is swap or remove
    address id = deployVotingContract(_startTime, _endTime, _affectedKey, _affectedKeyType, _miningKey);
    ballotsStorage.addBallot(id, _ballotType);
    BallotCreated(id);
  }

  function finalizeKeys(address id, int _progress, uint256 _totalVoters, address _affectedKey, uint256 _affectedKeyType, address _miningKey) public onlyVotingContract(id) {
    if(_progress > 0 && _totalVoters >= ballotsStorage.getMinThresholdOfVoters(id)) {
      ballotsStorage.updateBallot(id, uint8(QuorumStates.Accepted));
      if(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Adding)) {
        finalizeAdding(id, _affectedKey, _affectedKeyType, _miningKey);
      } else if(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Removal)) {
        finalizeRemoval(id, _affectedKey, _affectedKeyType, _miningKey);
      } else if(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Swap)) {
        finalizeSwap(id, _affectedKey, _affectedKeyType, _miningKey);
      }
    } else {
      ballotsStorage.updateBallot(id, uint8(QuorumStates.Rejected));
    }
    ballotsStorage.deactiveBallot(id);
    BallotFinalized(id);
  }

  function finalizeAdding(address id, address _affectedKey, uint256 _affectedKeyType, address _miningKey) private {
    require(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Adding));
    if(_affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.addMiningKey(_affectedKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.addVotingKey(_affectedKey, _miningKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.addPayoutKey(_affectedKey, _miningKey);
    }
  }

  function finalizeRemoval(address id, address _affectedKey, uint256 _affectedKeyType, address _miningKey) private {
    require(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Removal));
    if(_affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.removeMiningKey(_affectedKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.removeVotingKey(_miningKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.removePayoutKey(_miningKey);
    }
  }

  function finalizeSwap(address id, address _affectedKey, uint256 _affectedKeyType, address _miningKey) private {
    require(ballotsStorage.getBallotType(id) == uint256(BallotTypes.Swap));
    if(_affectedKeyType == uint256(KeyTypes.MiningKey)){
      keysManager.swapMiningKey(_affectedKey, _miningKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.VotingKey)){
      keysManager.swapVotingKey(_affectedKey, _miningKey);
    }
    if(_affectedKeyType == uint256(KeyTypes.PayoutKey)){
      keysManager.swapPayoutKey(_affectedKey, _miningKey);
    }
  }

  function deployVotingContract(
    uint256 _startTime,
    uint256 _endTime,
    address _affectedKey,
    uint256 _affectedKeyType,
    address _miningKey) private returns(address) 
  {
    return new VotingKeys(_startTime, _endTime, address(keysManager), _affectedKey, _affectedKeyType, _miningKey);
  }

  function deployThreshold(uint256 _startTime, uint256 _endTime, uint256 _proposedValue) private returns(address) {
    return new VotingChangeMinThreshold(_startTime, _endTime, address(keysManager), _proposedValue);
  }

  function AreBallotParamsValid(uint256 _ballotType, address _affectedKey, uint256 _affectedKeyType, address _miningKey) public view returns(bool) {
    bool isMiningActive = keysManager.isMiningActive(_miningKey);
    if(_affectedKeyType == uint256(KeyTypes.MiningKey)) {
      if(_ballotType == uint256(BallotTypes.Removal)) {
        return isMiningActive;
      }
      if(_ballotType == uint256(BallotTypes.Adding)){
        return true;
      }
    }
    require(_affectedKey != _miningKey);
    if( _ballotType == uint256(BallotTypes.Removal) || _ballotType == uint256(BallotTypes.Swap) ) {
      if(_affectedKeyType == uint256(KeyTypes.MiningKey)) {
        return isMiningActive;
      }
      if(_affectedKeyType == uint256(KeyTypes.VotingKey)) {
        address votingKey = keysManager.getVotingByMining(_miningKey);
        return keysManager.isVotingActive(votingKey) && _affectedKey == votingKey && isMiningActive;
      }
      if(_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
        address payoutKey = keysManager.getPayoutByMining(_miningKey);
        return keysManager.isPayoutActive(_miningKey) && _affectedKey == payoutKey && isMiningActive;
      }       
    }
    return true;
  }
}
