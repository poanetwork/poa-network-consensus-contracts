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

    uint8 constant public maxOldMiningKeysDeepCheck = 25;
    uint8 constant thresholdForKeysType = 1;

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

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function nextBallotId() public view returns(uint256) {
        return uintStorage[keccak256("nextBallotId")];
    }

    function activeBallotsLength() public view returns(uint256) {
        return uintStorage[keccak256("activeBallotsLength")];
    }

    function activeBallots(uint256 _index) public view returns(uint256) {
        return uintArrayStorage[keccak256("activeBallots")][_index];
    }

    function validatorActiveBallots(address _miningKey) public view returns(uint256) {
        return uintStorage[keccak256("validatorActiveBallots", _miningKey)];
    }

    function demoMode() public view returns(bool) {
        return boolStorage[keccak256("demoMode")];
    }

    function init(bool _demoMode) public onlyOwner {
        bytes32 initDisabledHash = keccak256("initDisabled");
        require(!boolStorage[initDisabledHash]);
        boolStorage[keccak256("demoMode")] = _demoMode;
        boolStorage[initDisabledHash] = true;
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

        bytes32 nextBallotIdHash = keccak256("nextBallotId");
        uint256 _nextBallotId = uintStorage[nextBallotIdHash];

        bytes32 activeBallotsHash = keccak256("activeBallots");

        uintStorage[keccak256("votingState", _nextBallotId, "startTime")] = _startTime;
        uintStorage[keccak256("votingState", _nextBallotId, "endTime")] = _endTime;
        addressStorage[keccak256("votingState", _nextBallotId, "affectedKey")] = _affectedKey;
        uintStorage[keccak256("votingState", _nextBallotId, "affectedKeyType")] = _affectedKeyType;
        addressStorage[keccak256("votingState", _nextBallotId, "miningKey")] = _miningKey;
        uintStorage[keccak256("votingState", _nextBallotId, "totalVoters")] = 0;
        intStorage[keccak256("votingState", _nextBallotId, "progress")] = 0;
        boolStorage[keccak256("votingState", _nextBallotId, "isFinalized")] = false;
        uintStorage[keccak256("votingState", _nextBallotId, "quorumState")] = uint8(QuorumStates.InProgress);
        uintStorage[keccak256("votingState", _nextBallotId, "ballotType")] = _ballotType;
        uintStorage[keccak256("votingState", _nextBallotId, "index")] = uintArrayStorage[activeBallotsHash].length;
        uintStorage[keccak256("votingState", _nextBallotId, "minThresholdOfVoters")] = getGlobalMinThresholdOfVoters();
        addressStorage[keccak256("votingState", _nextBallotId, "creator")] = creatorMiningKey;
        stringStorage[keccak256("votingState", _nextBallotId, "memo")] = memo;

        uintArrayStorage[activeBallotsHash].push(_nextBallotId);
        uintStorage[keccak256("activeBallotsLength")] =
            uintArrayStorage[activeBallotsHash].length;

        _increaseValidatorLimit();
        BallotCreated(_nextBallotId, _ballotType, msg.sender);
        uintStorage[nextBallotIdHash] = uintStorage[nextBallotIdHash].add(1);
    }

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!getIsFinalized(_id));
        // check for validation
        address miningKey = getMiningByVotingKey(msg.sender);
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Accept)) {
            intStorage[keccak256("votingState", _id, "progress")]++;
        } else if (_choice == uint(ActionChoice.Reject)) {
            intStorage[keccak256("votingState", _id, "progress")]--;
        } else {
            revert();
        }
        uintStorage[keccak256("votingState", _id, "totalVoters")]++;
        boolStorage[keccak256("votingState", _id, "voters", miningKey)] = true;
        Vote(_id, _choice, msg.sender, getTime(), miningKey);
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(_id < nextBallotId());
        require(getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!getIsFinalized(_id));
        finalizeBallot(_id);
        _decreaseValidatorLimit(_id);
        boolStorage[keccak256("votingState", _id, "isFinalized")] = true;
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
        for (uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
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
        for (uint8 i = 0; i < maxOldMiningKeysDeepCheck; i++) {
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
                if(_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == votingKey;
                } else {
                    keyCheck = _affectedKey != votingKey;
                }
                return keysManager.isVotingActive(votingKey) && keyCheck && isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                address payoutKey = keysManager.getPayoutByMining(_miningKey);
                if(_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == payoutKey;
                } else {
                    keyCheck = _affectedKey != payoutKey;
                }
                return keysManager.isPayoutActive(_miningKey) && keyCheck && isMiningActive;
            }       
        }
        return true;
    }

    function migrateBasicAll(address _prevVotingToChangeKeys) public onlyOwner {
        require(_prevVotingToChangeKeys != address(0));
        require(!boolStorage[keccak256("migrateDisabled")]);

        IVotingToChangeKeys prev =
            IVotingToChangeKeys(_prevVotingToChangeKeys);
        IPoaNetworkConsensusForVotingToChange poa =
            IPoaNetworkConsensusForVotingToChange(IProxyStorage(proxyStorage()).getPoaConsensus());

        uint256 _nextBallotId = prev.nextBallotId();
        uint256 _activeBallotsLength = prev.activeBallotsLength();
        uintStorage[keccak256("nextBallotId")] = _nextBallotId;
        uintStorage[keccak256("activeBallotsLength")] = _activeBallotsLength;

        bytes32 activeBallotsHash = keccak256("activeBallots");
        delete uintArrayStorage[activeBallotsHash];
        for (uint256 i = 0; i < _activeBallotsLength; i++) {
            uintArrayStorage[activeBallotsHash].push(prev.activeBallots(i));
        }

        uint256 currentValidatorsLength = poa.getCurrentValidatorsLength();
        for (i = 0; i < currentValidatorsLength; i++) {
            address miningKey = poa.currentValidators(i);
            uintStorage[keccak256("validatorActiveBallots", miningKey)] = 
                prev.validatorActiveBallots(miningKey);
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
        require(!boolStorage[keccak256("migrateDisabled")]);
        
        IVotingToChangeKeys prev =
            IVotingToChangeKeys(_prevVotingToChangeKeys);
        
        uintStorage[keccak256("votingState", _id, "startTime")] =
            prev.getStartTime(_id);
        uintStorage[keccak256("votingState", _id, "endTime")] =
            prev.getEndTime(_id);
        addressStorage[keccak256("votingState", _id, "affectedKey")] =
            prev.getAffectedKey(_id);
        uintStorage[keccak256("votingState", _id, "affectedKeyType")] = 
            prev.getAffectedKeyType(_id);
        addressStorage[keccak256("votingState", _id, "miningKey")] = 
            prev.getMiningKey(_id);
        uintStorage[keccak256("votingState", _id, "totalVoters")] = 
            prev.getTotalVoters(_id);
        intStorage[keccak256("votingState", _id, "progress")] = 
            prev.getProgress(_id);
        boolStorage[keccak256("votingState", _id, "isFinalized")] = 
            prev.getIsFinalized(_id);
        uintStorage[keccak256("votingState", _id, "quorumState")] =
            _quorumState;
        uintStorage[keccak256("votingState", _id, "ballotType")] = 
            prev.getBallotType(_id);
        uintStorage[keccak256("votingState", _id, "index")] =
            _index;
        uintStorage[keccak256("votingState", _id, "minThresholdOfVoters")] = 
            prev.getMinThresholdOfVoters(_id);
        for (uint256 i = 0; i < _voters.length; i++) {
            address miningKey = _voters[i];
            boolStorage[keccak256("votingState", _id, "voters", miningKey)] = true;
        }
        addressStorage[keccak256("votingState", _id, "creator")] = _creator;
        stringStorage[keccak256("votingState", _id, "memo")] = _memo;
    }

    function migrateDisable() public onlyOwner {
        require(!boolStorage[keccak256("migrateDisabled")]);
        boolStorage[keccak256("migrateDisabled")] = true;
    }

    function finalizeBallot(uint256 _id) private {
        if (getProgress(_id) > 0 && getTotalVoters(_id) >= getMinThresholdOfVoters(_id)) {
            updateBallot(_id, uint8(QuorumStates.Accepted));
            if (getBallotType(_id) == uint256(BallotTypes.Adding)) {
                finalizeAdding(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Removal)) {
                finalizeRemoval(_id);
            } else if (getBallotType(_id) == uint256(BallotTypes.Swap)) {
                finalizeSwap(_id);
            }
        } else {
            updateBallot(_id, uint8(QuorumStates.Rejected));
        }
        deactiveBallot(_id);
    }

    function updateBallot(uint256 _id, uint8 _quorumState) private {
        uintStorage[keccak256("votingState", _id, "quorumState")] = _quorumState;
    }

    function deactiveBallot(uint256 _id) private {
        bytes32 activeBallotsHash = keccak256("activeBallots");
        uint256 removedIndex = uintStorage[keccak256("votingState", _id, "index")];
        uint256 lastIndex = uintArrayStorage[activeBallotsHash].length - 1;
        uint256 lastBallotId = uintArrayStorage[activeBallotsHash][lastIndex];
        // Override the removed ballot with the last one.
        uintArrayStorage[activeBallotsHash][removedIndex] = lastBallotId;
        // Update the index of the last validator.
        uintStorage[keccak256("votingState", lastBallotId, "index")] = removedIndex;
        delete uintArrayStorage[activeBallotsHash][lastIndex];
        if (uintArrayStorage[activeBallotsHash].length > 0) {
            uintArrayStorage[activeBallotsHash].length--;
        }
        uintStorage[keccak256("activeBallotsLength")] =
            uintArrayStorage[activeBallotsHash].length;
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
        uintStorage[keccak256("validatorActiveBallots", miningKey)] = 
            uintStorage[keccak256("validatorActiveBallots", miningKey)].add(1);
    }

    function _decreaseValidatorLimit(uint256 _id) private {
        address miningKey = getCreator(_id);
        uintStorage[keccak256("validatorActiveBallots", miningKey)] = 
            uintStorage[keccak256("validatorActiveBallots", miningKey)].sub(1);
    }
}
