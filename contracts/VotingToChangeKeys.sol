pragma solidity ^0.4.18;

import "./SafeMath.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IVotingToChangeKeys.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";


contract VotingToChangeKeys is EternalStorage, IVotingToChangeKeys {
    using SafeMath for uint256;

    enum BallotTypes {Invalid, Adding, Removal, Swap}
    enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}
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

    function createVotingForKeys(
        uint256 _startTime,
        uint256 _endTime,
        address _affectedKey, 
        uint256 _affectedKeyType, 
        address _miningKey,
        uint256 _ballotType,
        string memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        require(_endTime > _startTime && _startTime > getTime());
        uint256 diffTime = _endTime.sub(_startTime);
        if (!demoMode()) {
            require(diffTime > 2 days);
        }
        require(diffTime <= 14 days);
        //only if ballotType is swap or remove
        require(areBallotParamsValid(_ballotType, _affectedKey, _affectedKeyType, _miningKey));
        address creatorMiningKey = getMiningByVotingKey(msg.sender);
        require(withinLimit(creatorMiningKey));
        uint256 _nextBallotId = nextBallotId();
        _setStartTime(_nextBallotId, _startTime);
        _setEndTime(_nextBallotId, _endTime);
        _setAffectedKey(_nextBallotId, _affectedKey);
        _setAffectedKeyType(_nextBallotId, _affectedKeyType);
        _setMiningKey(_nextBallotId, _miningKey);
        _setTotalVoters(_nextBallotId, 0);
        _setProgress(_nextBallotId, 0);
        _setIsFinalized(_nextBallotId, false);
        _setQuorumState(_nextBallotId, uint8(QuorumStates.InProgress));
        _setBallotType(_nextBallotId, _ballotType);
        _setIndex(_nextBallotId, activeBallotsLength());
        _setMinThresholdOfVoters(_nextBallotId, getGlobalMinThresholdOfVoters());
        _setCreator(_nextBallotId, creatorMiningKey);
        _setMemo(_nextBallotId, memo);
        _activeBallotsAdd(_nextBallotId);
        _increaseValidatorLimit();
        BallotCreated(_nextBallotId, _ballotType, msg.sender);
        _setNextBallotId(_nextBallotId.add(1));
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
        // check for validation
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

    function getBallotLimitPerValidator() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotLimitPerValidator();
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        uint8 thresholdForKeysType = 1;
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotThreshold(thresholdForKeysType);
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

    function getAffectedKeyType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "affectedKeyType")];
    }

    function getAffectedKey(uint256 _id) public view returns(address) {
        return addressStorage[keccak256("votingState", _id, "affectedKey")];
    }

    function getMiningKey(uint256 _id) public view returns(address) {
        return addressStorage[keccak256("votingState", _id, "miningKey")];
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getBallotType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256("votingState", _id, "ballotType")];
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

    function checkIfMiningExisted(address _currentKey, address _affectedKey) public view returns(bool) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_currentKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (oldMiningKey == _affectedKey) {
                return true;
            } else {
                _currentKey = oldMiningKey;
            }
        }
        return false;
    }

    function withinLimit(address _miningKey) public view returns(bool) {
        return validatorActiveBallots(_miningKey) <= getBallotLimitPerValidator();
    }

    function areBallotParamsValid(
        uint256 _ballotType,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey) public view returns(bool) 
    {
        if (_affectedKeyType == uint256(KeyTypes.MiningKey) && _ballotType != uint256(BallotTypes.Removal)) {
            require(!checkIfMiningExisted(_miningKey, _affectedKey));
        }
        require(_affectedKeyType > 0);
        require(_affectedKey != address(0));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        bool isMiningActive = keysManager.isMiningActive(_miningKey);
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            if (_ballotType == uint256(BallotTypes.Removal)) {
                return isMiningActive;
            }
            if (_ballotType == uint256(BallotTypes.Adding)) {
                return true;
            }
        }
        require(_affectedKey != _miningKey);
        bool keyCheck;
        if (_ballotType == uint256(BallotTypes.Removal) || _ballotType == uint256(BallotTypes.Swap)) {
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                address votingKey = keysManager.getVotingByMining(_miningKey);
                if (_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == votingKey;
                } else {
                    keyCheck = _affectedKey != votingKey;
                }
                return keysManager.isVotingActive(votingKey) && keyCheck && isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                address payoutKey = keysManager.getPayoutByMining(_miningKey);
                if (_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == payoutKey;
                } else {
                    keyCheck = _affectedKey != payoutKey;
                }
                return keysManager.isPayoutActive(_miningKey) && keyCheck && isMiningActive;
            }       
        }
        return true;
    }

    function migrateDisabled() public view returns(bool) {
        return boolStorage[keccak256("migrateDisabled")];
    }

    function migrateBasicAll(address _prevVotingToChangeKeys) public onlyOwner {
        require(_prevVotingToChangeKeys != address(0));
        require(!migrateDisabled());

        IVotingToChangeKeys prev =
            IVotingToChangeKeys(_prevVotingToChangeKeys);
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
        address _prevVotingToChangeKeys,
        uint8 _quorumState,
        uint256 _index,
        address _creator,
        string _memo,
        address[] _voters
    ) public onlyOwner {
        require(_prevVotingToChangeKeys != address(0));
        require(!migrateDisabled());
        
        IVotingToChangeKeys prev =
            IVotingToChangeKeys(_prevVotingToChangeKeys);
        
        _setStartTime(_id, prev.getStartTime(_id));
        _setEndTime(_id, prev.getEndTime(_id));
        _setAffectedKey(_id, prev.getAffectedKey(_id));
        _setAffectedKeyType(_id, prev.getAffectedKeyType(_id));
        _setMiningKey(_id, prev.getMiningKey(_id));
        _setTotalVoters(_id, prev.getTotalVoters(_id));
        _setProgress(_id, prev.getProgress(_id));
        _setIsFinalized(_id, prev.getIsFinalized(_id));
        _setQuorumState(_id, _quorumState);
        _setBallotType(_id, prev.getBallotType(_id));
        _setIndex(_id, _index);
        _setMinThresholdOfVoters(_id, prev.getMinThresholdOfVoters(_id));
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
            if (getBallotType(_id) == uint256(BallotTypes.Adding)) {
                finalizeAdding(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Removal)) {
                finalizeRemoval(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Swap)) {
                finalizeSwap(_id);
            }
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

    function finalizeAdding(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Adding));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.addMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.addVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.addPayoutKey(getAffectedKey(_id), getMiningKey(_id));
        }
    }

    function finalizeRemoval(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Removal));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.removeMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.removeVotingKey(getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.removePayoutKey(getMiningKey(_id));
        }
    }

    function finalizeSwap(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Swap));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.swapMiningKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.swapVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.swapPayoutKey(getAffectedKey(_id), getMiningKey(_id));
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

    function _setAffectedKey(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "affectedKey")] = _value;
    }

    function _setAffectedKeyType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "affectedKeyType")] = _value;
    }

    function _setMiningKey(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "miningKey")] = _value;
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

    function _setBallotType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "ballotType")] = _value;
    }

    function _setIndex(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "index")] = _value;
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
