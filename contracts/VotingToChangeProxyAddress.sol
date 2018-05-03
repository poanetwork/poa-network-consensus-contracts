pragma solidity ^0.4.18;
import "./SafeMath.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";


contract VotingToChangeProxyAddress { 
    using SafeMath for uint256;
    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice { Invalid, Accept, Reject }    

    IProxyStorage public proxyStorage;
    uint8 public maxOldMiningKeysDeepCheck = 25;
    uint256 public nextBallotId;
    uint256[] public activeBallots;
    uint256 public activeBallotsLength;
    bool public demoMode = false;

    struct VotingData {
        uint256 startTime;
        uint256 endTime;
        uint256 totalVoters;
        int progress;
        bool isFinalized;
        uint8 quorumState;
        uint256 index;
        uint256 minThresholdOfVoters;
        address proposedValue;
        uint8 contractType;
        mapping(address => bool) voters;
        address creator;
        string memo;
    }

    mapping(uint256 => VotingData) public votingState;
    mapping(address => uint256) public validatorActiveBallots;

    event Vote(uint256 indexed id, uint256 decision, address indexed voter, uint256 time );
    event BallotFinalized(uint256 indexed id, address indexed voter);
    event BallotCreated(uint256 indexed id, uint256 indexed ballotType, address indexed creator);

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function VotingToChangeProxyAddress(address _proxyStorage, bool _demoMode) public {
        proxyStorage = IProxyStorage(_proxyStorage);
        demoMode = _demoMode;
    }

    function createBallotToChangeProxyAddress(
        uint256 _startTime,
        uint256 _endTime,
        address _proposedValue,
        uint8 _contractType,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        if (!demoMode) {
            require(diffTime > 2 days);
        }
        require(diffTime <= 14 days);
        require(_proposedValue != address(0));
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        VotingData memory data = VotingData({
            startTime: _startTime,
            endTime: _endTime,
            totalVoters: 0,
            progress: 0,
            isFinalized: false,
            quorumState: uint8(QuorumStates.InProgress),
            index: activeBallots.length,
            proposedValue: _proposedValue,
            contractType: _contractType,
            minThresholdOfVoters: getGlobalMinThresholdOfVoters(),
            creator: creatorMiningKey,
            memo: memo
        });
        votingState[nextBallotId] = data;
        activeBallots.push(nextBallotId);
        activeBallotsLength = activeBallots.length;
        _increaseValidatorLimit();
        BallotCreated(nextBallotId, 5, msg.sender);
        nextBallotId++;
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
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
        Vote(_id, _choice, msg.sender, getTime());
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        VotingData storage ballot = votingState[_id];
        finalizeBallot(_id);
        _decreaseValidatorLimit(_id);
        ballot.isFinalized = true;
        BallotFinalized(_id, msg.sender);
    }

    function getProposedValue(uint256 _id) public view returns(address) {
        return votingState[_id].proposedValue;
    }
    
    function getContractType(uint256 _id) public view returns(uint256) {
        return votingState[_id].contractType;
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
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
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }
    
    function getBallotsStorage() public view returns(address) {
        return proxyStorage.getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return proxyStorage.getKeysManager();
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
    
    function getMemo(uint256 _id) public view returns(string) {
        return votingState[_id].memo;
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function isActive(uint256 _id) public view returns(bool) {
        bool withinTime = getStartTime(_id) <= getTime() && getTime() <= getEndTime(_id);
        return withinTime;
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
        IKeysManager keysManager = IKeysManager(getKeysManager());
        for (uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_miningKey);
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

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function withinLimit(address _miningKey) public view returns(bool) {
        return validatorActiveBallots[_miningKey] <= getBallotLimitPerValidator();
    }

    function finalizeBallot(uint256 _id) private {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            updateBallot(_id, uint8(QuorumStates.Accepted));
            proxyStorage.setContractAddress(getContractType(_id), getProposedValue(_id));
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
        VotingData storage ballot = votingState[_id];
        uint256 removedIndex = ballot.index;
        uint256 lastIndex = activeBallots.length - 1;
        uint256 lastBallotId = activeBallots[lastIndex];
        // Override the removed ballot with the last one.
        activeBallots[removedIndex] = lastBallotId;
        // Update the index of the last validator.
        votingState[lastBallotId].index = removedIndex;
        delete activeBallots[lastIndex];
        if (activeBallots.length > 0) {
            activeBallots.length--;
        }
        activeBallotsLength = activeBallots.length;
    }

    function _increaseValidatorLimit() private {
        address miningKey = getMiningByVotingKey(msg.sender);
        validatorActiveBallots[miningKey] = validatorActiveBallots[miningKey].add(1);
    }

    function _decreaseValidatorLimit(uint256 _id) private {
        VotingData storage ballot = votingState[_id];
        address miningKey = ballot.creator;
        validatorActiveBallots[miningKey] = validatorActiveBallots[miningKey].sub(1);
    }
}
