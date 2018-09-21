pragma solidity ^0.4.24;

import './VotingToChangeMock.sol';
import '../../contracts/VotingToChangeMinThreshold.sol';


contract VotingToChangeMinThresholdMock is VotingToChangeMock, VotingToChangeMinThreshold {
    function getProposedValue(uint256 _id) public view returns(uint256) {
        return _getProposedValue(_id);
    }

    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setMinPossibleThreshold(uint256 _minPossibleThreshold) public {
        uintStorage[MIN_POSSIBLE_THRESHOLD] = _minPossibleThreshold;
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }

    function votingState(uint256 _id) public view returns(
        uint256 startTime,
        uint256 endTime,
        uint256 totalVoters,
        int progress,
        bool isFinalized,
        uint8 quorumState,
        uint256 index,
        uint256 minThresholdOfVoters,
        uint256 proposedValue,
        address creator,
        string memo
    ) {
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        totalVoters = _getTotalVoters(_id);
        progress = _getProgress(_id);
        isFinalized = _getIsFinalized(_id);
        quorumState = uint8(getQuorumState(_id));
        index = getIndex(_id);
        minThresholdOfVoters = getMinThresholdOfVoters(_id);
        proposedValue = _getProposedValue(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
    }
}