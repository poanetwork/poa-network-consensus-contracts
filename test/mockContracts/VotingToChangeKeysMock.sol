pragma solidity ^0.4.24;

import './VotingToChangeMock.sol';
import '../../contracts/VotingToChangeKeys.sol';


contract VotingToChangeKeysMock is VotingToChangeMock, VotingToChangeKeys {
    function getAffectedKey(uint256 _id) public view returns(address) {
        return _getAffectedKey(_id);
    }

    function getAffectedKeyType(uint256 _id) public view returns(uint256) {
        return _getAffectedKeyType(_id);
    }

    function getBallotType(uint256 _id) public view returns(uint256) {
        return _getBallotType(_id);
    }

    function getMiningKey(uint256 _id) public view returns(address) {
        return _getMiningKey(_id);
    }

    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }

    function votingState(uint256 _id) public view returns(
        uint256 startTime,
        uint256 endTime,
        address affectedKey,
        uint256 affectedKeyType,
        address miningKey,
        uint256 totalVoters,
        int progress,
        bool isFinalized,
        uint8 quorumState,
        uint256 ballotType,
        uint256 index,
        uint256 minThresholdOfVoters,
        address creator,
        string memo
    ) {
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        affectedKey = _getAffectedKey(_id);
        affectedKeyType = _getAffectedKeyType(_id);
        miningKey = _getMiningKey(_id);
        totalVoters = _getTotalVoters(_id);
        progress = _getProgress(_id);
        isFinalized = _getIsFinalized(_id);
        quorumState = uint8(getQuorumState(_id));
        ballotType = _getBallotType(_id);
        index = getIndex(_id);
        minThresholdOfVoters = getMinThresholdOfVoters(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
    }
}