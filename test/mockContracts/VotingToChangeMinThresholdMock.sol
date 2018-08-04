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
}