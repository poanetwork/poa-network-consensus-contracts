pragma solidity ^0.4.18;

import "./SafeMath.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IVotingToChangeProxyAddress.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";


contract VotingToChangeProxyAddress is EternalStorage, IVotingToChangeProxyAddress {
    using SafeMath for uint256;
    
    enum QuorumStates {Invalid, InProgress, Accepted, Rejected}
    enum ActionChoice {Invalid, Accept, Reject}

    event Vote(uint256 indexed id, uint256 decision, address indexed voter, uint256 time, address voterMiningKey);
    event BallotFinalized(uint256 indexed id, address indexed voter);
    event BallotCreated(uint256 indexed id, uint256 indexed ballotType, address indexed creator);

    modifier onlyOwner() {
        require(msg.sender == addressStorage[keccak256("owner")]);
        _;
    }

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function maxOldMiningKeysDeepCheck() public pure returns(uint8) {
        return 25;
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function nextBallotId() public view returns(uint256) {
        return uintStorage[keccak256("nextBallotId")];
    }

    function activeBallotsLength() public view returns(uint256) {
        return uintArrayStorage[_activeBallotsHash()].length;
    }

    function activeBallots(uint256 _index) public view returns(uint256) {
        return uintArrayStorage[_activeBallotsHash()][_index];
    }

    function validatorActiveBallots(address _miningKey) public view returns(uint256) {
        return uintStorage[keccak256("validatorActiveBallots", _miningKey)];
    }

    function demoMode() public view returns(bool) {
        return boolStorage[keccak256("demoMode")];
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[keccak256("initDisabled")];
    }

    function init(bool _demoMode) public onlyOwner {
        require(!initDisabled());
        boolStorage[keccak256("demoMode")] = _demoMode;
        boolStorage[keccak256("initDisabled")] = true;
    }

    function createBallotToChangeProxyAddress(
        uint256 _startTime,
        uint256 _endTime,
        address _proposedValue,
        uint8 _contractType,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        if (!demoMode()) {
            require(diffTime > 2 days);
        }
        require(diffTime <= 14 days);
        require(_proposedValue != address(0));
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        uint256 _nextBallotId = nextBallotId();
        _setStartTime(_nextBallotId, _startTime);
        _setEndTime(_nextBallotId, _endTime);
        _setTotalVoters(_nextBallotId, 0);
        _setProgress(_nextBallotId, 0);
        _setIsFinalized(_nextBallotId, false);
        _setQuorumState(_nextBallotId, uint8(QuorumStates.InProgress));
        _setIndex(_nextBallotId, activeBallotsLength());
        _setProposedValue(_nextBallotId, _proposedValue);
        _setContractType(_nextBallotId, _contractType);
        _setMinThresholdOfVoters(_nextBallotId, getGlobalMinThresholdOfVoters());
        _setCreator(_nextBallotId, creatorMiningKey);
        _setMemo(_nextBallotId, memo);
        _activeBallotsAdd(_nextBallotId);
        _increaseValidatorLimit();
        BallotCreated(_nextBallotId, 5, msg.sender);
        _setNextBallotId(_nextBallotId.add(1));
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
        Vote(_id, _choice, msg.sender, getTime(), miningKey);
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_id < nextBallotId());
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        finalizeBallot(_id);
        _decreaseValidatorLimit(_id);
        _setIsFinalized(_id, true);
        BallotFinalized(_id, msg.sender);
    }

    function getBallotsStorage() public view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function getProposedValue(uint256 _id) public view returns(address) {
        return addressStorage[keccak256("votingState", _id, "proposedValue")];
    }
    
    function getContractType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "contractType")];
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
    }

    function getProgress(uint256 _id) public view returns(int) {
        return intStorage[keccak256("votingState", _id, "progress")];
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "totalVoters")];
    }

    function getMinThresholdOfVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "minThresholdOfVoters")];
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getStartTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "startTime")];
    }

    function getEndTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "endTime")];
    }

    function getIsFinalized(uint256 _id) public view returns(bool) {
        return boolStorage[keccak256("votingState", _id, "isFinalized")];
    }

    function getQuorumState(uint256 _id) public view returns(uint8) {
        return uint8(uintStorage[keccak256("votingState", _id, "quorumState")]);
    }

    function getIndex(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "index")];
    }

    function getCreator(uint256 _id) public view returns(address) {
        return addressStorage[keccak256("votingState", _id, "creator")];
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function isActive(uint256 _id) public view returns(bool) {
        bool withinTime = getStartTime(_id) <= getTime() && getTime() <= getEndTime(_id);
        return withinTime;
    }

    function getMemo(uint256 _id) public view returns(string) {
        return stringStorage[keccak256("votingState", _id, "memo")];
    }

    function hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey) public view returns(bool) {
        return boolStorage[keccak256("votingState", _id, "voters", _miningKey)];
    }

    function hasAlreadyVoted(uint256 _id, address _votingKey) public view returns(bool) {
        address miningKey = getMiningByVotingKey(_votingKey);
        return hasMiningKeyAlreadyVoted(_id, miningKey);
    }

    function isValidVote(uint256 _id, address _votingKey) public view returns(bool) {
        address miningKey = getMiningByVotingKey(_votingKey);
        bool notVoted = !hasAlreadyVoted(_id, _votingKey);
        bool oldKeysNotVoted = !areOldMiningKeysVoted(_id, miningKey);
        return notVoted && isActive(_id) && oldKeysNotVoted;
    }

    function areOldMiningKeysVoted(uint256 _id, address _miningKey) public view returns(bool) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_miningKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (hasMiningKeyAlreadyVoted(_id, oldMiningKey)) {
                return true;
            } else {
                _miningKey = oldMiningKey;
            }
        }
        return false;
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function withinLimit(address _miningKey) public view returns(bool) {
        return validatorActiveBallots(_miningKey) <= getBallotLimitPerValidator();
    }

    function migrateDisabled() public view returns(bool) {
        return boolStorage[keccak256("migrateDisabled")];
    }

    function migrateBasicAll(address _prevVotingToChangeProxy) public onlyOwner {
        require(_prevVotingToChangeProxy != address(0));
        require(!migrateDisabled());

        IVotingToChangeProxyAddress prev =
            IVotingToChangeProxyAddress(_prevVotingToChangeProxy);
        IPoaNetworkConsensusForVotingToChange poa =
            IPoaNetworkConsensusForVotingToChange(IProxyStorage(proxyStorage()).getPoaConsensus());

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

    function migrateBasicOne(
        uint256 _id,
        address _prevVotingToChangeProxy,
        uint8 _quorumState,
        uint256 _index,
        address _creator,
        string _memo,
        address[] _voters
    ) public onlyOwner {
        require(_prevVotingToChangeProxy != address(0));
        require(!migrateDisabled());
        
        IVotingToChangeProxyAddress prev =
            IVotingToChangeProxyAddress(_prevVotingToChangeProxy);

        _setStartTime(_id, prev.getStartTime(_id));
        _setEndTime(_id, prev.getEndTime(_id));
        _setTotalVoters(_id, prev.getTotalVoters(_id));
        _setProgress(_id, prev.getProgress(_id));
        _setIsFinalized(_id, prev.getIsFinalized(_id));
        _setQuorumState(_id, _quorumState);
        _setIndex(_id, _index);
        _setMinThresholdOfVoters(_id, prev.getMinThresholdOfVoters(_id));
        _setProposedValue(_id, prev.getProposedValue(_id));
        _setContractType(_id, prev.getContractType(_id));
        for (uint256 i = 0; i < _voters.length; i++) {
            address miningKey = _voters[i];
            _votersAdd(_id, miningKey);
        }
        _setCreator(_id, _creator);
        _setMemo(_id, _memo);
    }

    function migrateDisable() public onlyOwner {
        require(!migrateDisabled());
        boolStorage[keccak256("migrateDisabled")] = true;
    }

    function finalizeBallot(uint256 _id) private {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint8(QuorumStates.Accepted));
            IProxyStorage(proxyStorage()).setContractAddress(getContractType(_id), getProposedValue(_id));
        } else {
            _setQuorumState(_id, uint8(QuorumStates.Rejected));
        }
        deactiveBallot(_id);
    }

    function deactiveBallot(uint256 _id) private {
        uint256 removedIndex = getIndex(_id);
        uint256 lastIndex = activeBallotsLength() - 1;
        uint256 lastBallotId = activeBallots(lastIndex);
        // Override the removed ballot with the last one.
        _activeBallotsSet(removedIndex, lastBallotId);
        // Update the index of the last validator.
        _setIndex(lastBallotId, removedIndex);
        _activeBallotsSet(lastIndex, 0);
        if (activeBallotsLength() > 0) {
            _activeBallotsDecreaseLength();
        }
    }

    function _increaseValidatorLimit() private {
        address miningKey = getMiningByVotingKey(msg.sender);
        _setValidatorActiveBallots(miningKey, validatorActiveBallots(miningKey).add(1));
    }

    function _decreaseValidatorLimit(uint256 _id) private {
        address miningKey = getCreator(_id);
        _setValidatorActiveBallots(miningKey, validatorActiveBallots(miningKey).sub(1));
    }

    function _setNextBallotId(uint256 _id) private {
        uintStorage[keccak256("nextBallotId")] = _id;
    }

    function _activeBallotsHash() private pure returns(bytes32) {
        return keccak256("activeBallots");
    }

    function _activeBallotsAdd(uint256 _id) private {
        uintArrayStorage[_activeBallotsHash()].push(_id);
    }

    function _activeBallotsSet(uint256 _index, uint256 _id) private {
        uintArrayStorage[_activeBallotsHash()][_index] = _id;
    }

    function _activeBallotsDecreaseLength() private {
        uintArrayStorage[_activeBallotsHash()].length--;
    }

    function _activeBallotsClear() private {
        delete uintArrayStorage[_activeBallotsHash()];
    }

    function _setValidatorActiveBallots(address _miningKey, uint256 _count) private {
        uintStorage[keccak256("validatorActiveBallots", _miningKey)] = _count;
    }

    function _storeName() private pure returns(string) {
        return "votingState";
    }

    function _setStartTime(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "startTime")] = _value;
    }

    function _setEndTime(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "endTime")] = _value;
    }

    function _setTotalVoters(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "totalVoters")] = _value;
    }

    function _setProgress(uint256 _ballotId, int256 _value) private {
        intStorage[keccak256(_storeName(), _ballotId, "progress")] = _value;
    }

    function _setIsFinalized(uint256 _ballotId, bool _value) private {
        boolStorage[keccak256(_storeName(), _ballotId, "isFinalized")] = _value;
    }

    function _setQuorumState(uint256 _ballotId, uint8 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "quorumState")] = _value;
    }

    function _setIndex(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "index")] = _value;
    }

    function _setProposedValue(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "proposedValue")] = _value;
    }

    function _setContractType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "contractType")] = _value;
    }

    function _setMinThresholdOfVoters(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "minThresholdOfVoters")] = _value;
    }

    function _setCreator(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "creator")] = _value;
    }

    function _setMemo(uint256 _ballotId, string _value) private {
        stringStorage[keccak256(_storeName(), _ballotId, "memo")] = _value;
    }

    function _votersAdd(uint256 _ballotId, address _miningKey) private {
        boolStorage[keccak256(_storeName(), _ballotId, "voters", _miningKey)] = true;
    }

}
