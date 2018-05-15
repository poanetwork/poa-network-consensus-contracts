pragma solidity ^0.4.23;

import "./interfaces/IEmissionFunds.sol";
import "./abstracts/VotingTo.sol";


contract VotingToManageEmissionFunds is VotingTo {
    enum QuorumStates {Invalid, InProgress, Sent, Burnt, Frozen}
    enum ActionChoice {Invalid, Send, Burn, Freeze}

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _receiver,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        uint256 currentTime = getTime();
        require(_endTime > _startTime && _startTime > currentTime);
        uint256 releaseTime = refreshEmissionReleaseTime();
        require(_startTime > releaseTime);
        require(currentTime > releaseTime);
        require(_endTime.sub(releaseTime) <= distributionThreshold());
        require(_receiver != address(0));
        require(previousBallotFinalized());
        uint256 ballotId = nextBallotId();
        _setStartTime(ballotId, _startTime);
        _setEndTime(ballotId, _endTime);
        _setSendVotes(ballotId, 0);
        _setBurnVotes(ballotId, 0);
        _setFreezeVotes(ballotId, 0);
        _setIsFinalized(ballotId, false);
        _setQuorumState(ballotId, uint8(QuorumStates.InProgress));
        _setReceiver(ballotId, _receiver);
        _setMinThresholdOfVoters(ballotId, getGlobalMinThresholdOfVoters());
        _setCreator(ballotId, getMiningByVotingKey(msg.sender));
        _setMemo(ballotId, memo);
        _setPreviousBallotFinalized(false);
        _setNextBallotId(ballotId.add(1));
        emit BallotCreated(ballotId, 6, msg.sender);
    }

    function distributionThreshold() public view returns(uint256) {
        return uintStorage[keccak256("distributionThreshold")];
    }

    function emissionFunds() public view returns(address) {
        return addressStorage[keccak256("emissionFunds")];
    }

    function emissionReleaseThreshold() public view returns(uint256) {
        return uintStorage[keccak256("emissionReleaseThreshold")];
    }

    function emissionReleaseTime() public view returns(uint256) {
        return uintStorage[keccak256("emissionReleaseTime")];
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_id == nextBallotId().sub(1));
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        require(!previousBallotFinalized());
        _finalizeBallot(_id);
        _setIsFinalized(_id, true);
        _setPreviousBallotFinalized(true);
        _setEmissionReleaseTime(
            emissionReleaseTime().add(emissionReleaseThreshold())
        );
        emit BallotFinalized(_id, msg.sender);
    }

    function getBurnVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "burnVotes")];
    }

    function getFreezeVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "freezeVotes")];
    }

    function getReceiver(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "receiver")];
    }

    function getSendVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "sendVotes")];
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return getSendVotes(_id).add(getBurnVotes(_id)).add(getFreezeVotes(_id));
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
        _setPreviousBallotFinalized(true);
        _setEmissionReleaseTime(_emissionReleaseTime);
        addressStorage[keccak256("emissionFunds")] = _emissionFunds;
        uintStorage[keccak256("emissionReleaseThreshold")] = _emissionReleaseThreshold;
        uintStorage[keccak256("distributionThreshold")] = _distributionThreshold;
        boolStorage[keccak256("initDisabled")] = true;
    }

    function previousBallotFinalized() public view returns(bool) {
        return boolStorage[keccak256("previousBallotFinalized")];
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
        emit Vote(_id, _choice, msg.sender, getTime(), miningKey);
    }

    function _finalizeBallot(uint256 _id) private {
        if (getTotalVoters(_id) < getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint8(QuorumStates.Frozen));
            return;
        }

        QuorumStates quorumState = QuorumStates.Frozen;
        uint256 sendVotesCount = getSendVotes(_id);
        uint256 burnVotesCount = getBurnVotes(_id);
        uint256 freezeVotesCount = getFreezeVotes(_id);
        
        if (
            sendVotesCount != burnVotesCount &&
            burnVotesCount != freezeVotesCount &&
            sendVotesCount != freezeVotesCount
        ) {
            uint256 max = _max(sendVotesCount, burnVotesCount, freezeVotesCount);
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

        _setQuorumState(_id, uint8(quorumState));

        if (quorumState == QuorumStates.Sent) {
            IEmissionFunds(emissionFunds()).sendFundsTo(getReceiver(_id));
        } else if (quorumState == QuorumStates.Burnt) {
            IEmissionFunds(emissionFunds()).burnFunds();
        }
    }

    function _max(uint256 a, uint256 b, uint256 c) private pure returns(uint256) {
        uint256 max = a;
        (max < b) && ((max = b) != 0);
        (max < c) && ((max = c) != 0);
        return max;
    }

    function _setBurnVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "burnVotes")] = _value;
    }

    function _setEmissionReleaseTime(uint256 _time) private {
        uintStorage[keccak256("emissionReleaseTime")] = _time;
    }

    function _setFreezeVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "freezeVotes")] = _value;
    }

    function _setPreviousBallotFinalized(bool _finalized) private {
        boolStorage[keccak256("previousBallotFinalized")] = _finalized;
    }

    function _setReceiver(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "receiver")] = _value;
    }

    function _setSendVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "sendVotes")] = _value;
    }
}
