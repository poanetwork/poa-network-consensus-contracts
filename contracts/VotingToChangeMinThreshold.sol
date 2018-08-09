pragma solidity ^0.4.24;

import "./interfaces/IVotingToChangeMinThreshold.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeMinThreshold is IVotingToChangeMinThreshold, VotingToChange {
    bytes32 internal constant MIN_POSSIBLE_THRESHOLD = keccak256("minPossibleThreshold");

    string internal constant PROPOSED_VALUE = "proposedValue";

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _proposedValue,
        string _memo
    ) public {
        require(_proposedValue >= minPossibleThreshold());
        require(_proposedValue != _getGlobalMinThresholdOfVoters());
        require(_proposedValue <= _getBallotsStorage().getProxyThreshold());
        uint256 ballotId = _createBallot(
            uint256(BallotTypes.MinThreshold),
            _startTime,
            _endTime,
            _memo
        );
        _setProposedValue(ballotId, _proposedValue);
    }

    function getBallotInfo(uint256 _id, address _votingKey) public view returns(
        uint256 startTime,
        uint256 endTime,
        uint256 totalVoters,
        int256 progress,
        bool isFinalized,
        uint256 proposedValue,
        address creator,
        string memo,
        bool canBeFinalizedNow,
        bool hasAlreadyVoted
    ) {
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        totalVoters = _getTotalVoters(_id);
        progress = _getProgress(_id);
        isFinalized = _getIsFinalized(_id);
        proposedValue = _getProposedValue(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
        canBeFinalizedNow = _canBeFinalizedNow(_id);
        hasAlreadyVoted = this.hasAlreadyVoted(_id, _votingKey);
    }

    function init(
        uint256 _minBallotDuration,
        uint256 _minPossibleThreshold
    ) public {
        require(_minPossibleThreshold > 0);
        _init(_minBallotDuration);
        uintStorage[MIN_POSSIBLE_THRESHOLD] = _minPossibleThreshold;
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
        IVotingToChangeMinThresholdPrev prev =
            IVotingToChangeMinThresholdPrev(_prevVotingToChange);
        _setProposedValue(_id, prev.getProposedValue(_id));
    }

    function minPossibleThreshold() public view returns(uint256) {
        return uintStorage[MIN_POSSIBLE_THRESHOLD];
    }

    function _finalizeBallotInner(uint256 _id) internal returns(bool) {
        return _getBallotsStorage().setThreshold(
            _getProposedValue(_id),
            uint8(ThresholdTypes.Keys)
        );
    }

    function _getProposedValue(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, PROPOSED_VALUE))];
    }

    function _setProposedValue(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, PROPOSED_VALUE))
        ] = _value;
    }

}
