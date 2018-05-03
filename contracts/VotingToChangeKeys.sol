pragma solidity ^0.4.18;
import "./SafeMath.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";


contract VotingToChangeKeys { 
    using SafeMath for uint256;
    enum BallotTypes {Invalid, Adding, Removal, Swap}
    enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}
    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice { Invalid, Accept, Reject }
    
    IProxyStorage public proxyStorage;
    uint8 public maxOldMiningKeysDeepCheck = 25;
    uint256 public nextBallotId;
    uint256[] public activeBallots;
    uint256 public activeBallotsLength;
    uint8 thresholdForKeysType = 1;
    bool public demoMode = false;

    struct VotingData {
        uint256 startTime;
        uint256 endTime;
        address affectedKey;
        uint256 affectedKeyType;
        address miningKey;
        uint256 totalVoters;
        int progress;
        bool isFinalized;
        uint8 quorumState;
        uint256 ballotType;
        uint256 index;
        uint256 minThresholdOfVoters;
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

    function VotingToChangeKeys(address _proxyStorage, bool _demoMode) public {
        proxyStorage = IProxyStorage(_proxyStorage);
        demoMode = _demoMode;
    }

    function createVotingForKeys(
        uint256 _startTime,
        uint256 _endTime,
        address _affectedKey, 
        uint256 _affectedKeyType, 
        address _miningKey,
        uint256 _ballotType,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        if (!demoMode) {
            require(diffTime > 2 days);
        }
        require(diffTime <= 14 days);
        //only if ballotType is swap or remove
        require(areBallotParamsValid(_ballotType, _affectedKey, _affectedKeyType, _miningKey));
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        VotingData memory data = VotingData({
            startTime: _startTime,
            endTime: _endTime,
            affectedKey: _affectedKey,
            affectedKeyType: _affectedKeyType,
            miningKey: _miningKey,
            totalVoters: 0,
            progress: 0,
            isFinalized: false,
            quorumState: uint8(QuorumStates.InProgress),
            ballotType: _ballotType,
            index: activeBallots.length,
            minThresholdOfVoters: getGlobalMinThresholdOfVoters(),
            creator: creatorMiningKey,
            memo: memo
        });
        votingState[nextBallotId] = data;
        activeBallots.push(nextBallotId);
        activeBallotsLength = activeBallots.length;
        _increaseValidatorLimit();
        BallotCreated(nextBallotId, _ballotType, msg.sender);
        nextBallotId++;
    }
    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
        VotingData storage ballot = votingState[_id];
        // // check for validation;
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

    function getBallotsStorage() public view returns(address) {
        return proxyStorage.getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return proxyStorage.getKeysManager();
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
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

    function getAffectedKeyType(uint256 _id) public view returns(uint256) {
        return votingState[_id].affectedKeyType;
    }

    function getAffectedKey(uint256 _id) public view returns(address) {
        return votingState[_id].affectedKey;
    }

    function getMiningKey(uint256 _id) public view returns(address) {
        return votingState[_id].miningKey;
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getBallotType(uint256 _id) public view returns(uint256) {
        return votingState[_id].ballotType;
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
        return withinTime;
    }

    function getMemo(uint256 _id) public view returns(string) {
        return votingState[_id].memo;
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
        IKeysManager keysManager = IKeysManager(getKeysManager());
        VotingData storage ballot = votingState[_id];
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

    function checkIfMiningExisted(address _currentKey, address _affectedKey) public view returns(bool) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        for (uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_currentKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (oldMiningKey == _affectedKey) {
                return true;
            } else {
                _currentKey = oldMiningKey;
            }
        }
        return false;
    }

    function withinLimit(address _miningKey) public view returns(bool) {
        return validatorActiveBallots[_miningKey] <= getBallotLimitPerValidator();
    }

    function areBallotParamsValid(
        uint256 _ballotType,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey) public view returns(bool) 
    {
        if (_affectedKeyType == uint256(KeyTypes.MiningKey) && _ballotType != uint256(BallotTypes.Removal)) {
            require(!checkIfMiningExisted(_miningKey, _affectedKey));
        }
        require(_affectedKeyType > 0);
        require(_affectedKey != address(0));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        bool isMiningActive = keysManager.isMiningActive(_miningKey);
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            if (_ballotType == uint256(BallotTypes.Removal)) {
                return isMiningActive;
            }
            if (_ballotType == uint256(BallotTypes.Adding)) {
                return true;
            }
        }
        require(_affectedKey != _miningKey);
        bool keyCheck;
        if (_ballotType == uint256(BallotTypes.Removal) || _ballotType == uint256(BallotTypes.Swap)) {
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                address votingKey = keysManager.getVotingByMining(_miningKey);
                if(_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == votingKey;
                } else {
                    keyCheck = _affectedKey != votingKey;
                }
                return keysManager.isVotingActive(votingKey) && keyCheck && isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                address payoutKey = keysManager.getPayoutByMining(_miningKey);
                if(_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == payoutKey;
                } else {
                    keyCheck = _affectedKey != payoutKey;
                }
                return keysManager.isPayoutActive(_miningKey) && keyCheck && isMiningActive;
            }       
        }
        return true;
    }

    function finalizeBallot(uint256 _id) private {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            updateBallot(_id, uint8(QuorumStates.Accepted));
            if (getBallotType(_id) == uint256(BallotTypes.Adding)) {
                finalizeAdding(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Removal)) {
                finalizeRemoval(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Swap)) {
                finalizeSwap(_id);
            }
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

    function finalizeAdding(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Adding));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.addMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.addVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.addPayoutKey(getAffectedKey(_id), getMiningKey(_id));
        }
    }

    function finalizeRemoval(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Removal));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.removeMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.removeVotingKey(getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.removePayoutKey(getMiningKey(_id));
        }
    }

    function finalizeSwap(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Swap));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.swapMiningKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.swapVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.swapPayoutKey(getAffectedKey(_id), getMiningKey(_id));
        }
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
