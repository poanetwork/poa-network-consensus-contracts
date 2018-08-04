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
}