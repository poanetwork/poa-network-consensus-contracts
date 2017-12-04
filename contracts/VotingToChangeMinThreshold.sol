pragma solidity ^0.4.18;
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IBallotsStorage.sol";


contract VotingToChangeMinThreshold { 
    using SafeMath for uint256;
    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice { Invalid, Accept, Reject }

    IBallotsStorage public ballotsStorage;
    IKeysManager public keysManager;
    uint8 public maxOldMiningKeysDeepCheck = 25;
    uint256 public nextBallotId;
    uint256[] public activeBallots;
    uint256 public activeBallotsLength;
    uint8 thresholdForKeysType = 1;

    struct VotingData {
        uint256 startTime;
        uint256 endTime;
        uint256 totalVoters;
        int progress;
        bool isFinalized;
        uint8 quorumState;
        uint256 index;
        uint256 minThresholdOfVoters;
        uint256 proposedValue;
        mapping(address => bool) voters;
    }

    mapping(uint256 => VotingData) public votingState;

    event Vote(uint256 indexed decision, address indexed voter, uint256 time );
    event BallotFinalized(uint256 indexed id, address indexed voter);
    event BallotCreated(uint256 indexed id, uint256 indexed ballotType, address indexed creator);

    modifier onlyValidVotingKey(address _votingKey) {
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function VotingToChangeMinThreshold(address _keysContract, address _ballotsStorage) public {
        keysManager = IKeysManager(_keysContract);
        ballotsStorage = IBallotsStorage(_ballotsStorage);
    }

    function createBallotToChangeThreshold(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _proposedValue
        ) public onlyValidVotingKey(msg.sender) {
        require(activeBallotsLength <= 100);
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        require(_proposedValue >= 3 && _proposedValue != getGlobalMinThresholdOfVoters());
        VotingData memory data = VotingData({
            startTime: _startTime,
            endTime: _endTime,
            totalVoters: 0,
            progress: 0,
            isFinalized: false,
            quorumState: uint8(QuorumStates.InProgress),
            index: activeBallots.length,
            proposedValue: _proposedValue,
            minThresholdOfVoters: getGlobalMinThresholdOfVoters()
        });
        votingState[nextBallotId] = data;
        activeBallots.push(nextBallotId);
        activeBallotsLength = activeBallots.length;
        BallotCreated(nextBallotId, 4, msg.sender);
        nextBallotId++;
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        VotingData storage ballot = votingState[_id];
        address miningKey = getMiningByVotingKey(msg.sender);
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Accept)) {
            ballot.progress++;
        } else if (_choice == uint(ActionChoice.Reject)) {
            ballot.progress--;
        } else {
            revert();
        }
        ballot.totalVoters++;
        ballot.voters[miningKey] = true;
        Vote(_choice, msg.sender, getTime());
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(!isActive(_id));
        VotingData storage ballot = votingState[_id];
        finalizeBallot(_id);
        ballot.isFinalized = true;
        BallotFinalized(_id, msg.sender);
    }

    function getProposedValue(uint256 _id) public view returns(uint256) {
        return votingState[_id].proposedValue;
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        return ballotsStorage.getBallotThreshold(thresholdForKeysType);
    }

    function getProgress(uint256 _id) public view returns(int) {
        return votingState[_id].progress;
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return votingState[_id].totalVoters;
    }

    function getMinThresholdOfVoters(uint256 _id) public view returns(uint256) {
        return votingState[_id].minThresholdOfVoters;
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getStartTime(uint256 _id) public view returns(uint256) {
        return votingState[_id].startTime;
    }

    function getEndTime(uint256 _id) public view returns(uint256) {
        return votingState[_id].endTime;
    }

    function getIsFinalized(uint256 _id) public view returns(bool) {
        return votingState[_id].isFinalized;
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function isActive(uint256 _id) public view returns(bool) {
        bool withinTime = getStartTime(_id) <= getTime() && getTime() <= getEndTime(_id);
        return withinTime && !getIsFinalized(_id);
    }

    function hasAlreadyVoted(uint256 _id, address _votingKey) public view returns(bool) {
        VotingData storage ballot = votingState[_id];
        address miningKey = getMiningByVotingKey(_votingKey);
        return ballot.voters[miningKey];
    }
    
    function isValidVote(uint256 _id, address _votingKey) public view returns(bool) {
        address miningKey = getMiningByVotingKey(_votingKey);
        bool notVoted = !hasAlreadyVoted(_id, _votingKey);
        bool oldKeysNotVoted = !areOldMiningKeysVoted(_id, miningKey);
        return notVoted && isActive(_id) && oldKeysNotVoted;
    }

    function areOldMiningKeysVoted(uint256 _id, address _miningKey) public view returns(bool) {
        VotingData storage ballot = votingState[_id];
        for (uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
            address oldMiningKey = keysManager.miningKeyHistory(_miningKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (ballot.voters[oldMiningKey]) {
                return true;
            } else {
                _miningKey = oldMiningKey;
            }
        }
        return false;
    }

    function finalizeBallot(uint256 _id) private {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            updateBallot(_id, uint8(QuorumStates.Accepted));
            ballotsStorage.setThreshold(getProposedValue(_id), thresholdForKeysType);
        } else {
            updateBallot(_id, uint8(QuorumStates.Rejected));
        }
        deactiveBallot(_id);
    }

    function updateBallot(uint256 _id, uint8 _quorumState) private {
        VotingData storage ballot = votingState[_id];
        ballot.quorumState = _quorumState;
    }

    function deactiveBallot(uint256 _id) private {
        VotingData memory ballot = votingState[_id];
        delete activeBallots[ballot.index];
        if (activeBallots.length > 0) {
            activeBallots.length--;
        }
        activeBallotsLength = activeBallots.length;
    }
}
