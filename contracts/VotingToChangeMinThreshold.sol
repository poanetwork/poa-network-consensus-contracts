pragma solidity ^0.4.23;

import "./interfaces/IVotingToChangeMinThreshold.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeMinThreshold is IVotingToChangeMinThreshold, VotingToChange {
    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _proposedValue,
        string memo
    ) public {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        if (demoMode()) {
            require(_proposedValue >= 1);
        } else {
            require(_proposedValue >= 3);
        }
        require(_proposedValue != getGlobalMinThresholdOfVoters());
        require(_proposedValue <= ballotsStorage.getProxyThreshold());
        uint256 ballotType = 4;
        uint256 ballotId = _createBallot(ballotType, _startTime, _endTime, memo);
        _setProposedValue(ballotId, _proposedValue);
    }

    function getProposedValue(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "proposedValue")];
    }

    function migrateBasicOne(
        uint256 _id,
        address _prevVotingToChange,
        uint8 _quorumState,
        uint256 _index,
        address _creator,
        string _memo,
        address[] _voters
    ) public {
        _migrateBasicOne(
            _id,
            _prevVotingToChange,
            _quorumState,
            _index,
            _creator,
            _memo,
            _voters
        );
        IVotingToChangeMinThreshold prev =
            IVotingToChangeMinThreshold(_prevVotingToChange);
        _setProposedValue(_id, prev.getProposedValue(_id));
    }

    function _finalizeBallotInner(uint256 _id) internal {
        uint8 thresholdForKeysType = 1;
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        ballotsStorage.setThreshold(getProposedValue(_id), thresholdForKeysType);
    }

    function _setProposedValue(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "proposedValue")] = _value;
    }

}
