pragma solidity ^0.4.24;

import "../interfaces/IPoaNetworkConsensus.sol";
import "../interfaces/IVotingToChangePrev.sol";
import "./VotingTo.sol";


contract VotingToChange is VotingTo {
    bytes32 internal constant ACTIVE_BALLOTS = keccak256("activeBallots");
    bytes32 internal constant MIGRATE_DISABLED = keccak256("migrateDisabled");
    bytes32 internal constant MIN_BALLOT_DURATION = keccak256("minBallotDuration");

    bytes32 internal constant INDEX = "index";
    bytes32 internal constant FINALIZE_CALLED = "finalizeCalled";
    bytes32 internal constant PROGRESS = "progress";
    bytes32 internal constant TOTAL_VOTERS = "totalVoters";
    bytes32 internal constant VALIDATOR_ACTIVE_BALLOTS = "validatorActiveBallots";

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

    function getIndex(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, INDEX))];
    }

    function init(uint256 _minBallotDuration) public {
        _init(_minBallotDuration);
    }

    function maxBallotDuration() public pure returns(uint256) {
        return 14 days;
    }

    function migrateBasicAll(address _prevVotingToChange) public onlyOwner {
        require(_prevVotingToChange != address(0));
        require(initDisabled());
        require(!migrateDisabled());

        IVotingToChangePrev prev =
            IVotingToChangePrev(_prevVotingToChange);
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
        require(initDisabled());
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
            keccak256(abi.encode(VALIDATOR_ACTIVE_BALLOTS, _miningKey))
        ];
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(migrateDisabled());
        require(!_getIsFinalized(_id));
        address miningKey = _getKeysManager().getMiningKeyByVoting(msg.sender);
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Accept)) {
            _setProgress(_id, _getProgress(_id) + 1);
        } else if (_choice == uint(ActionChoice.Reject)) {
            _setProgress(_id, _getProgress(_id) - 1);
        } else {
            revert();
        }
        _votersAdd(_id, miningKey);
        _setTotalVoters(_id, _getTotalVoters(_id).add(1));
        emit Vote(_id, _choice, msg.sender, getTime(), miningKey);
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
        if (!migrateDisabled()) return false;

        uint256 currentTime = getTime();
        uint256 startTime = _getStartTime(_id);

        if (_id >= nextBallotId()) return false;
        if (startTime > currentTime) return false;
        if (_getIsFinalized(_id)) return false;
        
        uint256 validatorsLength = IPoaNetworkConsensus(
            IProxyStorage(proxyStorage()).getPoaConsensus()
        ).getCurrentValidatorsLengthWithoutMoC();

        if (validatorsLength == 0) {
            return false;
        }
        
        if (_getTotalVoters(_id) < validatorsLength) {
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
        require(migrateDisabled());
        address creatorMiningKey = _getKeysManager().getMiningKeyByVoting(msg.sender);
        require(_withinLimit(creatorMiningKey));
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
        address miningKey = _getCreator(_id);
        uint256 ballotsCount = validatorActiveBallots(miningKey);
        if (ballotsCount > 0) {
            _setValidatorActiveBallots(miningKey, ballotsCount - 1);
        }
    }

    function _finalizeBallot(uint256 _id) internal {
        if (!_getFinalizeCalled(_id)) {
            _decreaseValidatorLimit(_id);
            _setFinalizeCalled(_id);
        }

        if (_getProgress(_id) > 0 && _getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            if (_finalizeBallotInner(_id)) {
                _setQuorumState(_id, uint8(QuorumStates.Accepted));
            } else {
                return;
            }
        } else {
            _setQuorumState(_id, uint8(QuorumStates.Rejected));
        }

        _deactiveBallot(_id);
        _setIsFinalized(_id, true);
        emit BallotFinalized(_id, msg.sender);
    }

    function _finalizeBallotInner(uint256 _id) internal returns(bool);

    function _getBallotLimitPerValidator() internal view returns(uint256) {
        return _getBallotsStorage().getBallotLimitPerValidator();
    }

    function _getFinalizeCalled(uint256 _id) internal view returns(bool) {
        return boolStorage[
            keccak256(abi.encode(FINALIZE_CALLED, _id))
        ];
    }

    function _getProgress(uint256 _id) internal view returns(int) {
        return intStorage[keccak256(abi.encode(VOTING_STATE, _id, PROGRESS))];
    }

    function _getTotalVoters(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, TOTAL_VOTERS))];
    }

    function _increaseValidatorLimit(address _miningKey) internal {
        _setValidatorActiveBallots(_miningKey, validatorActiveBallots(_miningKey).add(1));
    }

    function _init(uint256 _minBallotDuration) internal onlyOwner {
        require(!initDisabled());
        require(!migrateDisabled());
        require(_minBallotDuration < maxBallotDuration());
        uintStorage[MIN_BALLOT_DURATION] = _minBallotDuration;
        boolStorage[INIT_DISABLED] = true;
    }

    function _setIndex(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, INDEX))
        ] = _value;
    }

    function _setFinalizeCalled(uint256 _id) internal {
        boolStorage[
            keccak256(abi.encode(FINALIZE_CALLED, _id))
        ] = true;
    }

    function _setProgress(uint256 _ballotId, int256 _value) internal {
        intStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, PROGRESS))
        ] = _value;
    }

    function _setTotalVoters(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, TOTAL_VOTERS))
        ] = _value;
    }

    function _setValidatorActiveBallots(address _miningKey, uint256 _count) internal {
        uintStorage[
            keccak256(abi.encode(VALIDATOR_ACTIVE_BALLOTS, _miningKey))
        ] = _count;
    }

    function _withinLimit(address _miningKey) internal view returns(bool) {
        return validatorActiveBallots(_miningKey) < _getBallotLimitPerValidator();
    }
}
