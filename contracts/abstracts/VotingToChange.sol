pragma solidity ^0.4.24;

import "../interfaces/IBallotsStorage.sol";
import "../interfaces/IPoaNetworkConsensus.sol";
import "../interfaces/IVotingToChange.sol";
import "./VotingTo.sol";


contract VotingToChange is IVotingToChange, VotingTo {
    bytes32 internal constant ACTIVE_BALLOTS = keccak256("activeBallots");
    bytes32 internal constant MIGRATE_DISABLED = keccak256("migrateDisabled");
    bytes32 internal constant MIN_BALLOT_DURATION = keccak256("minBallotDuration");

    string internal constant INDEX = "index";
    string internal constant PROGRESS = "progress";
    string internal constant TOTAL_VOTERS = "totalVoters";
    string internal constant VALIDATOR_ACTIVE_BALLOTS = "validatorActiveBallots";

    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice {Invalid, Accept, Reject}

    modifier onlyValidTime(uint256 _startTime, uint256 _endTime) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        require(diffTime > minBallotDuration());
        require(diffTime <= maxBallotDuration());
        _;
    }

    function activeBallots(uint256 _index) public view returns(uint256) {
        return uintArrayStorage[ACTIVE_BALLOTS][_index];
    }

    function activeBallotsLength() public view returns(uint256) {
        return uintArrayStorage[ACTIVE_BALLOTS].length;
    }

    function canBeFinalizedNow(uint256 _id) public view returns(bool) {
        return _canBeFinalizedNow(_id);
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_canBeFinalizedNow(_id));
        _finalizeBallot(_id);
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function getIndex(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked(VOTING_STATE, _id, INDEX))];
    }

    function getProgress(uint256 _id) public view returns(int) {
        return intStorage[keccak256(abi.encodePacked(VOTING_STATE, _id, PROGRESS))];
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked(VOTING_STATE, _id, TOTAL_VOTERS))];
    }

    function init(uint256 _minBallotDuration) public {
        _init(_minBallotDuration);
    }

    function maxBallotDuration() public pure returns(uint256) {
        return 14 days;
    }

    function migrateBasicAll(address _prevVotingToChange) public onlyOwner {
        require(_prevVotingToChange != address(0));
        require(!migrateDisabled());

        IVotingToChange prev =
            IVotingToChange(_prevVotingToChange);
        IPoaNetworkConsensusForVotingToChange poa =
            IPoaNetworkConsensusForVotingToChange(
                IProxyStorage(proxyStorage()).getPoaConsensus()
            );

        _setNextBallotId(prev.nextBallotId());

        uint256 i;
        uint256 _activeBallotsLength = prev.activeBallotsLength();
        _activeBallotsClear();
        for (i = 0; i < _activeBallotsLength; i++) {
            _activeBallotsAdd(prev.activeBallots(i));
        }

        uint256 currentValidatorsLength = poa.getCurrentValidatorsLength();
        for (i = 0; i < currentValidatorsLength; i++) {
            address miningKey = poa.currentValidators(i);
            uint256 count = prev.validatorActiveBallots(miningKey);
            _setValidatorActiveBallots(miningKey, count);
        }
    }

    function migrateDisable() public onlyOwner {
        require(!migrateDisabled());
        boolStorage[MIGRATE_DISABLED] = true;
    }

    function migrateDisabled() public view returns(bool) {
        return boolStorage[MIGRATE_DISABLED];
    }

    function minBallotDuration() public view returns(uint256) {
        return uintStorage[MIN_BALLOT_DURATION];
    }

    function validatorActiveBallots(address _miningKey) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VALIDATOR_ACTIVE_BALLOTS, _miningKey))
        ];
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
        address miningKey = getMiningByVotingKey(msg.sender);
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Accept)) {
            _setProgress(_id, getProgress(_id) + 1);
        } else if (_choice == uint(ActionChoice.Reject)) {
            _setProgress(_id, getProgress(_id) - 1);
        } else {
            revert();
        }
        _votersAdd(_id, miningKey);
        _setTotalVoters(_id, getTotalVoters(_id).add(1));
        emit Vote(_id, _choice, msg.sender, getTime(), miningKey);
    }

    function withinLimit(address _miningKey) public view returns(bool) {
        return validatorActiveBallots(_miningKey) <= getBallotLimitPerValidator();
    }

    function _activeBallotsAdd(uint256 _id) internal {
        uintArrayStorage[ACTIVE_BALLOTS].push(_id);
    }

    function _activeBallotsClear() internal {
        delete uintArrayStorage[ACTIVE_BALLOTS];
    }

    function _activeBallotsDecreaseLength() internal {
        if (activeBallotsLength() > 0) {
            uintArrayStorage[ACTIVE_BALLOTS].length--;
        }
    }

    function _activeBallotsSet(uint256 _index, uint256 _id) internal {
        uintArrayStorage[ACTIVE_BALLOTS][_index] = _id;
    }

    function _canBeFinalizedNow(uint256 _id) internal view returns(bool) {
        uint256 currentTime = getTime();
        uint256 startTime = getStartTime(_id);

        if (_id >= nextBallotId()) return false;
        if (startTime > currentTime) return false;
        if (getIsFinalized(_id)) return false;
        
        uint256 validatorsLength = IPoaNetworkConsensus(
            IProxyStorage(proxyStorage()).getPoaConsensus()
        ).getCurrentValidatorsLengthWithoutMoC();

        if (validatorsLength == 0) {
            return false;
        }
        
        if (getTotalVoters(_id) < validatorsLength) {
            return !isActive(_id);
        }

        uint256 diffTime = currentTime.sub(startTime);
        return diffTime > minBallotDuration();
    }

    function _createBallot(
        uint256 _ballotType,
        uint256 _startTime,
        uint256 _endTime,
        string _memo
    )
        internal
        onlyValidVotingKey(msg.sender)
        onlyValidTime(_startTime, _endTime)
        returns(uint256)
    {
        require(initDisabled());
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        uint256 ballotId = super._createBallot(
            _ballotType,
            _startTime,
            _endTime,
            _memo,
            uint8(QuorumStates.InProgress),
            creatorMiningKey
        );
        _setTotalVoters(ballotId, 0);
        _setProgress(ballotId, 0);
        _setIndex(ballotId, activeBallotsLength());
        _activeBallotsAdd(ballotId);
        _increaseValidatorLimit(creatorMiningKey);
        return ballotId;
    }

    function _deactiveBallot(uint256 _id) internal {
        uint256 removedIndex = getIndex(_id);
        uint256 lastIndex = activeBallotsLength() - 1;
        uint256 lastBallotId = activeBallots(lastIndex);
        // Override the removed ballot with the last one.
        _activeBallotsSet(removedIndex, lastBallotId);
        // Update the index of the last validator.
        _setIndex(lastBallotId, removedIndex);
        _activeBallotsSet(lastIndex, 0);
        _activeBallotsDecreaseLength();
    }

    function _decreaseValidatorLimit(uint256 _id) internal {
        address miningKey = getCreator(_id);
        uint256 ballotsCount = validatorActiveBallots(miningKey);
        if (ballotsCount > 0) {
            _setValidatorActiveBallots(miningKey, ballotsCount - 1);
        }
    }

    function _finalizeBallot(uint256 _id) internal {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint8(QuorumStates.Accepted));
            _finalizeBallotInner(_id);
        } else {
            _setQuorumState(_id, uint8(QuorumStates.Rejected));
        }
        _deactiveBallot(_id);
        _decreaseValidatorLimit(_id);
        _setIsFinalized(_id, true);
        emit BallotFinalized(_id, msg.sender);
    }

    function _finalizeBallotInner(uint256 _id) internal;

    function _increaseValidatorLimit(address _miningKey) internal {
        _setValidatorActiveBallots(_miningKey, validatorActiveBallots(_miningKey).add(1));
    }

    function _init(uint256 _minBallotDuration) internal onlyOwner {
        require(!initDisabled());
        require(_minBallotDuration < maxBallotDuration());
        uintStorage[MIN_BALLOT_DURATION] = _minBallotDuration;
        boolStorage[INIT_DISABLED] = true;
    }

    function _migrateBasicOne(
        uint256 _id,
        address _prevVotingToChange,
        uint8 _quorumState,
        uint256 _index,
        address _creator,
        string _memo,
        address[] _voters
    ) internal onlyOwner {
        require(_prevVotingToChange != address(0));
        require(!migrateDisabled());
        IVotingToChange prev = IVotingToChange(_prevVotingToChange);
        _setStartTime(_id, prev.getStartTime(_id));
        _setEndTime(_id, prev.getEndTime(_id));
        _setTotalVoters(_id, prev.getTotalVoters(_id));
        _setProgress(_id, prev.getProgress(_id));
        _setIsFinalized(_id, prev.getIsFinalized(_id));
        _setQuorumState(_id, _quorumState);
        _setIndex(_id, _index);
        _setMinThresholdOfVoters(_id, prev.getMinThresholdOfVoters(_id));
        for (uint256 i = 0; i < _voters.length; i++) {
            address miningKey = _voters[i];
            _votersAdd(_id, miningKey);
        }
        _setCreator(_id, _creator);
        _setMemo(_id, _memo);
    }

    function _setIndex(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, INDEX))
        ] = _value;
    }

    function _setProgress(uint256 _ballotId, int256 _value) internal {
        intStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, PROGRESS))
        ] = _value;
    }

    function _setTotalVoters(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, TOTAL_VOTERS))
        ] = _value;
    }

    function _setValidatorActiveBallots(address _miningKey, uint256 _count) internal {
        uintStorage[
            keccak256(abi.encodePacked(VALIDATOR_ACTIVE_BALLOTS, _miningKey))
        ] = _count;
    }
}
