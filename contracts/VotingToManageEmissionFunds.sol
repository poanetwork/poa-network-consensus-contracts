pragma solidity ^0.4.18;

import "./SafeMath.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IEmissionFunds.sol";
import "./eternal-storage/EternalStorage.sol";


contract VotingToManageEmissionFunds is EternalStorage {
    using SafeMath for uint256;
    
    enum QuorumStates {Invalid, InProgress, Sent, Burnt, Frozen}
    enum ActionChoice {Invalid, Send, Burn, Freeze}

    event Vote(uint256 indexed id, uint256 decision, address indexed voter, uint256 time, address voterMiningKey);
    event BallotFinalized(uint256 indexed id, address indexed voter);
    event BallotCreated(uint256 indexed id, uint256 indexed ballotType, address indexed creator);

    modifier onlyOwner() {
        require(msg.sender == addressStorage[keccak256("owner")]);
        _;
    }

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function maxOldMiningKeysDeepCheck() public pure returns(uint8) {
        return 25;
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function nextBallotId() public view returns(uint256) {
        return uintStorage[keccak256("nextBallotId")];
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[keccak256("initDisabled")];
    }

    function emissionReleaseTime() public view returns(uint256) {
        return uintStorage[keccak256("emissionReleaseTime")];
    }

    function refreshEmissionReleaseTime() public returns(uint256) {
        uint256 releaseTime = emissionReleaseTime();
        uint256 currentTime = getTime();
        if (currentTime > releaseTime) {
            uint256 releaseThreshold = emissionReleaseThreshold();
            uint256 diff = currentTime.sub(releaseTime).div(releaseThreshold);
            if (diff > 0) {
                releaseTime = releaseTime.add(releaseThreshold.mul(diff));
                _setEmissionReleaseTime(releaseTime);
            }
        }
        return releaseTime;
    }

    function emissionReleaseThreshold() public view returns(uint256) {
        return uintStorage[keccak256("emissionReleaseThreshold")];
    }

    function distributionThreshold() public view returns(uint256) {
        return uintStorage[keccak256("distributionThreshold")];
    }

    function emissionFunds() public view returns(address) {
        return addressStorage[keccak256("emissionFunds")];
    }

    function init(
        address _emissionFunds,
        uint256 _emissionReleaseTime,
        uint256 _emissionReleaseThreshold,
        uint256 _distributionThreshold
    ) public onlyOwner {
        require(!initDisabled());
        require(_emissionFunds != address(0));
        require(_emissionReleaseTime > getTime());
        require(_emissionReleaseThreshold > 0);
        require(_distributionThreshold > 0);
        require(_emissionReleaseThreshold > _distributionThreshold);
        _setLastBallotFinalized(true);
        _setEmissionReleaseTime(_emissionReleaseTime);
        addressStorage[keccak256("emissionFunds")] = _emissionFunds;
        uintStorage[keccak256("emissionReleaseThreshold")] = _emissionReleaseThreshold;
        uintStorage[keccak256("distributionThreshold")] = _distributionThreshold;
        boolStorage[keccak256("initDisabled")] = true;
    }

    function createBallotToManageEmissionFunds(
        uint256 _startTime,
        uint256 _endTime,
        address _sendTo,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        uint256 currentTime = getTime();
        require(_endTime > _startTime && _startTime > currentTime);
        uint256 releaseTime = refreshEmissionReleaseTime();
        require(_startTime > releaseTime);
        require(currentTime > releaseTime);
        require(_endTime.sub(releaseTime) <= distributionThreshold());
        require(_sendTo != address(0));
        require(lastBallotFinalized());
        uint256 ballotId = nextBallotId();
        _setStartTime(ballotId, _startTime);
        _setEndTime(ballotId, _endTime);
        _setSendVotes(ballotId, 0);
        _setBurnVotes(ballotId, 0);
        _setFreezeVotes(ballotId, 0);
        _setIsFinalized(ballotId, false);
        _setQuorumState(ballotId, uint8(QuorumStates.InProgress));
        _setSendTo(ballotId, _sendTo);
        _setMinThresholdOfVoters(ballotId, getGlobalMinThresholdOfVoters());
        _setCreator(ballotId, getMiningByVotingKey(msg.sender));
        _setMemo(ballotId, memo);
        _setLastBallotFinalized(false);
        BallotCreated(ballotId, 6, msg.sender);
        _setNextBallotId(ballotId.add(1));
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Send)) {
            _setSendVotes(_id, getSendVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Burn)) {
            _setBurnVotes(_id, getBurnVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Freeze)) {
            _setFreezeVotes(_id, getFreezeVotes(_id).add(1));
        } else {
            revert();
        }
        address miningKey = getMiningByVotingKey(msg.sender);
        _votersAdd(_id, miningKey);
        Vote(_id, _choice, msg.sender, getTime(), miningKey);
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_id == nextBallotId().sub(1));
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        require(!lastBallotFinalized());
        _finalizeBallot(_id);
        _setIsFinalized(_id, true);
        _setLastBallotFinalized(true);
        _setEmissionReleaseTime(
            emissionReleaseTime().add(emissionReleaseThreshold())
        );
        BallotFinalized(_id, msg.sender);
    }

    function getBallotsStorage() public view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotThreshold(1);
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return getSendVotes(_id) + getBurnVotes(_id) + getFreezeVotes(_id);
    }

    function getSendVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "sendVotes")];
    }

    function getBurnVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "burnVotes")];
    }

    function getFreezeVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "freezeVotes")];
    }

    function getMinThresholdOfVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "minThresholdOfVoters")];
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getStartTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "startTime")];
    }

    function getEndTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "endTime")];
    }

    function getIsFinalized(uint256 _id) public view returns(bool) {
        return boolStorage[keccak256(_storeName(), _id, "isFinalized")];
    }

    function lastBallotFinalized() public view returns(bool) {
        return boolStorage[keccak256("lastBallotFinalized")];
    }

    function getQuorumState(uint256 _id) public view returns(uint8) {
        return uint8(uintStorage[keccak256(_storeName(), _id, "quorumState")]);
    }

    function getSendTo(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "sendTo")];
    }

    function getCreator(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "creator")];
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function isActive(uint256 _id) public view returns(bool) {
        bool withinTime = getStartTime(_id) <= getTime() && getTime() <= getEndTime(_id);
        return withinTime;
    }

    function getMemo(uint256 _id) public view returns(string) {
        return stringStorage[keccak256(_storeName(), _id, "memo")];
    }

    function hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey) public view returns(bool) {
        return boolStorage[keccak256(_storeName(), _id, "voters", _miningKey)];
    }

    function hasAlreadyVoted(uint256 _id, address _votingKey) public view returns(bool) {
        address miningKey = getMiningByVotingKey(_votingKey);
        return hasMiningKeyAlreadyVoted(_id, miningKey);
    }

    function isValidVote(uint256 _id, address _votingKey) public view returns(bool) {
        address miningKey = getMiningByVotingKey(_votingKey);
        bool notVoted = !hasAlreadyVoted(_id, _votingKey);
        bool oldKeysNotVoted = !areOldMiningKeysVoted(_id, miningKey);
        return notVoted && isActive(_id) && oldKeysNotVoted;
    }

    function areOldMiningKeysVoted(uint256 _id, address _miningKey) public view returns(bool) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_miningKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (hasMiningKeyAlreadyVoted(_id, oldMiningKey)) {
                return true;
            } else {
                _miningKey = oldMiningKey;
            }
        }
        return false;
    }

    function _finalizeBallot(uint256 _id) private {
        QuorumStates quorumState = QuorumStates.Frozen;

        if (getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            uint256 sendVotesCount = getSendVotes(_id);
            uint256 burnVotesCount = getBurnVotes(_id);
            uint256 freezeVotesCount = getFreezeVotes(_id);

            if (
                sendVotesCount != burnVotesCount &&
                burnVotesCount != freezeVotesCount &&
                sendVotesCount != freezeVotesCount
            ) {
                uint256 max = 0;
                if (sendVotesCount > max) max = sendVotesCount;
                if (burnVotesCount > max) max = burnVotesCount;
                if (freezeVotesCount > max) max = freezeVotesCount;
                if (max == sendVotesCount) quorumState = QuorumStates.Sent;
                else if (max == burnVotesCount) quorumState = QuorumStates.Burnt;
            } else {
                if (
                    burnVotesCount == freezeVotesCount &&
                    sendVotesCount > burnVotesCount
                ) {
                    quorumState = QuorumStates.Sent;
                } else if (
                    sendVotesCount == freezeVotesCount &&
                    burnVotesCount > sendVotesCount
                ) {
                    quorumState = QuorumStates.Burnt;
                }
            }
        }

        _setQuorumState(_id, uint8(quorumState));

        if (quorumState == QuorumStates.Sent) {
            IEmissionFunds(emissionFunds()).sendFundsTo(getSendTo(_id));
        } else if (quorumState == QuorumStates.Burnt) {
            IEmissionFunds(emissionFunds()).burnFunds();
        }
    }

    function _setNextBallotId(uint256 _id) private {
        uintStorage[keccak256("nextBallotId")] = _id;
    }

    function _storeName() private pure returns(string) {
        return "votingState";
    }

    function _setStartTime(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "startTime")] = _value;
    }

    function _setEndTime(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "endTime")] = _value;
    }

    function _setSendVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "sendVotes")] = _value;
    }

    function _setBurnVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "burnVotes")] = _value;
    }

    function _setFreezeVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "freezeVotes")] = _value;
    }

    function _setIsFinalized(uint256 _ballotId, bool _value) private {
        boolStorage[keccak256(_storeName(), _ballotId, "isFinalized")] = _value;
    }

    function _setLastBallotFinalized(bool _finalized) private {
        boolStorage[keccak256("lastBallotFinalized")] = _finalized;
    }

    function _setQuorumState(uint256 _ballotId, uint8 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "quorumState")] = _value;
    }

    function _setSendTo(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "sendTo")] = _value;
    }

    function _setMinThresholdOfVoters(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "minThresholdOfVoters")] = _value;
    }

    function _setCreator(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "creator")] = _value;
    }

    function _setMemo(uint256 _ballotId, string _value) private {
        stringStorage[keccak256(_storeName(), _ballotId, "memo")] = _value;
    }

    function _votersAdd(uint256 _ballotId, address _miningKey) private {
        boolStorage[keccak256(_storeName(), _ballotId, "voters", _miningKey)] = true;
    }

    function _setEmissionReleaseTime(uint256 _time) private {
        uintStorage[keccak256("emissionReleaseTime")] = _time;
    }

}
