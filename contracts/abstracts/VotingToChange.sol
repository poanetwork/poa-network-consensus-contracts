pragma solidity ^0.4.23;

import "../interfaces/IBallotsStorage.sol";
import "../interfaces/IPoaNetworkConsensus.sol";
import "../interfaces/IVotingToChange.sol";
import "./VotingTo.sol";


contract VotingToChange is IVotingToChange, VotingTo {
    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice {Invalid, Accept, Reject}

    modifier onlyValidTime(uint256 _startTime, uint256 _endTime) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        if (!demoMode()) {
            require(diffTime > 2 days);
        }
        require(diffTime <= 14 days);
        _;
    }

    function activeBallots(uint256 _index) public view returns(uint256) {
        return uintArrayStorage[_activeBallotsHash()][_index];
    }

    function activeBallotsLength() public view returns(uint256) {
        return uintArrayStorage[_activeBallotsHash()].length;
    }

    function demoMode() public view returns(bool) {
        return boolStorage[keccak256("demoMode")];
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_id < nextBallotId());
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        _finalizeBallot(_id);
        _decreaseValidatorLimit(_id);
        _setIsFinalized(_id, true);
        emit BallotFinalized(_id, msg.sender);
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function getIndex(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "index")];
    }

    function getProgress(uint256 _id) public view returns(int) {
        return intStorage[keccak256(_storeName(), _id, "progress")];
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "totalVoters")];
    }

    function init(bool _demoMode) public onlyOwner {
        require(!initDisabled());
        boolStorage[keccak256("demoMode")] = _demoMode;
        boolStorage[keccak256("initDisabled")] = true;
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

        uint256 _activeBallotsLength = prev.activeBallotsLength();
        _activeBallotsClear();
        for (uint256 i = 0; i < _activeBallotsLength; i++) {
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
        boolStorage[keccak256("migrateDisabled")] = true;
    }

    function migrateDisabled() public view returns(bool) {
        return boolStorage[keccak256("migrateDisabled")];
    }

    function validatorActiveBallots(address _miningKey) public view returns(uint256) {
        return uintStorage[keccak256("validatorActiveBallots", _miningKey)];
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
        uintArrayStorage[_activeBallotsHash()].push(_id);
    }

    function _activeBallotsClear() internal {
        delete uintArrayStorage[_activeBallotsHash()];
    }

    function _activeBallotsDecreaseLength() internal {
        if (activeBallotsLength() > 0) {
            uintArrayStorage[_activeBallotsHash()].length--;
        }
    }

    function _activeBallotsHash() internal pure returns(bytes32) {
        return keccak256("activeBallots");
    }

    function _activeBallotsSet(uint256 _index, uint256 _id) internal {
        uintArrayStorage[_activeBallotsHash()][_index] = _id;
    }

    function _createBallot(
        uint256 _ballotType,
        uint256 _startTime,
        uint256 _endTime,
        string memo
    )
        internal
        onlyValidVotingKey(msg.sender)
        onlyValidTime(_startTime, _endTime)
        returns(uint256)
    {
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        uint256 ballotId = nextBallotId();
        _setStartTime(ballotId, _startTime);
        _setEndTime(ballotId, _endTime);
        _setTotalVoters(ballotId, 0);
        _setProgress(ballotId, 0);
        _setIsFinalized(ballotId, false);
        _setQuorumState(ballotId, uint8(QuorumStates.InProgress));
        _setIndex(ballotId, activeBallotsLength());
        _setMinThresholdOfVoters(ballotId, getGlobalMinThresholdOfVoters());
        _setCreator(ballotId, creatorMiningKey);
        _setMemo(ballotId, memo);
        _activeBallotsAdd(ballotId);
        _increaseValidatorLimit(creatorMiningKey);
        _setNextBallotId(ballotId.add(1));
        emit BallotCreated(ballotId, _ballotType, msg.sender);
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
        _setValidatorActiveBallots(miningKey, validatorActiveBallots(miningKey).sub(1));
    }

    function _finalizeBallot(uint256 _id) internal {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint8(QuorumStates.Accepted));
            _finalizeBallotInner(_id);
        } else {
            _setQuorumState(_id, uint8(QuorumStates.Rejected));
        }
        _deactiveBallot(_id);
    }

    function _finalizeBallotInner(uint256 _id) internal;

    function _increaseValidatorLimit(address _miningKey) internal {
        _setValidatorActiveBallots(_miningKey, validatorActiveBallots(_miningKey).add(1));
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
        uintStorage[keccak256(_storeName(), _ballotId, "index")] = _value;
    }

    function _setProgress(uint256 _ballotId, int256 _value) internal {
        intStorage[keccak256(_storeName(), _ballotId, "progress")] = _value;
    }

    function _setTotalVoters(uint256 _ballotId, uint256 _value) internal {
        uintStorage[keccak256(_storeName(), _ballotId, "totalVoters")] = _value;
    }

    function _setValidatorActiveBallots(address _miningKey, uint256 _count) internal {
        uintStorage[keccak256("validatorActiveBallots", _miningKey)] = _count;
    }
}
