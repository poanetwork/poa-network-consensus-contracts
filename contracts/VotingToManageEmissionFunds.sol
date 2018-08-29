pragma solidity ^0.4.24;

import "./interfaces/IEmissionFunds.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./abstracts/VotingTo.sol";


contract VotingToManageEmissionFunds is VotingTo {
    bytes32 internal constant DISTRIBUTION_THRESHOLD =
        keccak256("distributionThreshold");
    
    bytes32 internal constant EMISSION_FUNDS =
        keccak256("emissionFunds");
    
    bytes32 internal constant EMISSION_RELEASE_THRESHOLD =
        keccak256("emissionReleaseThreshold");
    
    bytes32 internal constant EMISSION_RELEASE_TIME =
        keccak256("emissionReleaseTime");
    
    bytes32 internal constant NO_ACTIVE_BALLOT_EXISTS =
        keccak256("noActiveBallotExists");

    bytes32 internal constant AMOUNT = "amount";
    bytes32 internal constant BURN_VOTES = "burnVotes";
    bytes32 internal constant CREATION_TIME = "creationTime";
    bytes32 internal constant EMISSION_RELEASE_TIME_SNAPSHOT = "emissionReleaseTimeSnapshot";
    bytes32 internal constant FREEZE_VOTES = "freezeVotes";
    bytes32 internal constant IS_CANCELED = "isCanceled";
    bytes32 internal constant RECEIVER = "receiver";
    bytes32 internal constant SEND_VOTES = "sendVotes";

    event BallotCanceled(
        uint256 indexed id,
        address indexed votingKey
    );

    enum QuorumStates {Invalid, InProgress, Sent, Burnt, Frozen}
    enum ActionChoice {Invalid, Send, Burn, Freeze}

    function ballotCancelingThreshold() public pure returns(uint256) {
        return 15 minutes;
    }

    // solhint-disable code-complexity
    function canBeFinalizedNow(uint256 _id) public view returns(bool) {
        if (_id >= nextBallotId()) return false;
        if (_id != nextBallotId().sub(1)) return false;
        if (_getStartTime(_id) > getTime()) return false;
        if (isActive(_id)) return false;
        if (_getIsCanceled(_id)) return false;
        if (_getIsFinalized(_id)) return false;
        if (noActiveBallotExists()) return false;
        if (_withinCancelingThreshold(_id)) return false;
        return true;
    }
    // solhint-enable code-complexity

    function cancelNewBallot() public {
        uint256 ballotId = nextBallotId().sub(1);
        require(_getKeysManager().getMiningKeyByVoting(msg.sender) == _getCreator(ballotId));
        require(_withinCancelingThreshold(ballotId));
        require(!_getIsCanceled(ballotId));
        require(!_getIsFinalized(ballotId));
        _setIsCanceled(ballotId, true);
        _setNoActiveBallotExists(true);
        _setEmissionReleaseTime(_getEmissionReleaseTimeSnapshot(ballotId));
        emit BallotCanceled(ballotId, msg.sender);
    }

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _receiver,
        string _memo
    ) public onlyValidVotingKey(msg.sender) {
        require(_startTime > 0 && _endTime > 0);
        uint256 currentTime = getTime();
        require(_endTime > _startTime && _startTime > currentTime);
        uint256 releaseTimeSnapshot = emissionReleaseTime();
        uint256 releaseTime = refreshEmissionReleaseTime();
        require(currentTime >= releaseTime);
        require(_endTime.sub(releaseTime) <= distributionThreshold());
        require(_receiver != address(0));
        require(noActiveBallotExists());
        uint256 ballotId = _createBallot(
            uint256(BallotTypes.ManageEmissionFunds),
            _startTime,
            _endTime,
            _memo,
            uint256(QuorumStates.InProgress),
            _getKeysManager().getMiningKeyByVoting(msg.sender)
        );
        _setSendVotes(ballotId, 0);
        _setBurnVotes(ballotId, 0);
        _setFreezeVotes(ballotId, 0);
        _setReceiver(ballotId, _receiver);
        _setAmount(ballotId, emissionFunds().balance);
        _setNoActiveBallotExists(false);
        _setCreationTime(ballotId, currentTime);
        _setEmissionReleaseTimeSnapshot(ballotId, releaseTimeSnapshot);
        _setIsCanceled(ballotId, false);
    }

    function distributionThreshold() public view returns(uint256) {
        return uintStorage[DISTRIBUTION_THRESHOLD];
    }

    function emissionFunds() public view returns(address) {
        return addressStorage[EMISSION_FUNDS];
    }

    function emissionReleaseThreshold() public view returns(uint256) {
        return uintStorage[EMISSION_RELEASE_THRESHOLD];
    }

    function emissionReleaseTime() public view returns(uint256) {
        return uintStorage[EMISSION_RELEASE_TIME];
    }

    function finalize(uint256 _id) public onlyValidVotingKey(msg.sender) {
        require(canBeFinalizedNow(_id));
        _finalize(_id);
    }

    function getBallotInfo(uint256 _id) public view returns(
        uint256 creationTime,
        uint256 startTime,
        uint256 endTime,
        bool isCanceled,
        bool isFinalized,
        address creator,
        string memo,
        uint256 amount,
        uint256 burnVotes,
        uint256 freezeVotes,
        uint256 sendVotes,
        address receiver
    ) {
        creationTime = _getCreationTime(_id);
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        isCanceled = _getIsCanceled(_id);
        isFinalized = _getIsFinalized(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
        amount = _getAmount(_id);
        burnVotes = _getBurnVotes(_id);
        freezeVotes = _getFreezeVotes(_id);
        sendVotes = _getSendVotes(_id);
        receiver = _getReceiver(_id);
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return _getSendVotes(_id).add(_getBurnVotes(_id)).add(_getFreezeVotes(_id));
    }

    function init(
        address _emissionFunds,
        uint256 _emissionReleaseTime, // unix timestamp
        uint256 _emissionReleaseThreshold, // seconds
        uint256 _distributionThreshold // seconds
    ) public onlyOwner {
        require(!initDisabled());
        require(_emissionFunds != address(0));
        require(_emissionReleaseTime > getTime());
        require(_emissionReleaseThreshold > 0);
        require(_distributionThreshold > ballotCancelingThreshold());
        require(_emissionReleaseThreshold > _distributionThreshold);
        _setNoActiveBallotExists(true);
        _setEmissionReleaseTime(_emissionReleaseTime);
        addressStorage[EMISSION_FUNDS] = _emissionFunds;
        uintStorage[EMISSION_RELEASE_THRESHOLD] = _emissionReleaseThreshold;
        uintStorage[DISTRIBUTION_THRESHOLD] = _distributionThreshold;
        boolStorage[INIT_DISABLED] = true;
    }

    function noActiveBallotExists() public view returns(bool) {
        return boolStorage[NO_ACTIVE_BALLOT_EXISTS];
    }

    function refreshEmissionReleaseTime() public returns(uint256) {
        require(initDisabled());
        uint256 releaseTime = emissionReleaseTime();
        uint256 currentTime = getTime();
        if (currentTime > releaseTime) {
            uint256 releaseThreshold = emissionReleaseThreshold();
            uint256 diff = currentTime.sub(releaseTime).div(releaseThreshold);
            if (diff > 0) {
                releaseTime = releaseTime.add(releaseThreshold.mul(diff));
                _setEmissionReleaseTime(releaseTime);
            }
        }
        return releaseTime;
    }

    function vote(uint256 _id, uint256 _choice) public onlyValidVotingKey(msg.sender) {
        require(!_getIsCanceled(_id));
        require(!_getIsFinalized(_id));
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Send)) {
            _setSendVotes(_id, _getSendVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Burn)) {
            _setBurnVotes(_id, _getBurnVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Freeze)) {
            _setFreezeVotes(_id, _getFreezeVotes(_id).add(1));
        } else {
            revert();
        }
        address miningKey = _getKeysManager().getMiningKeyByVoting(msg.sender);
        _votersAdd(_id, miningKey);
        emit Vote(_id, _choice, msg.sender, getTime(), miningKey);

        uint256 validatorsLength = IPoaNetworkConsensus(
            IProxyStorage(proxyStorage()).getPoaConsensus()
        ).getCurrentValidatorsLengthWithoutMoC();
        
        if (getTotalVoters(_id) >= validatorsLength && !_withinCancelingThreshold(_id)) {
            _finalize(_id);
        }
    }

    // solhint-disable code-complexity, function-max-lines
    function _finalize(uint256 _id) internal {
        require(_isEOA(msg.sender));

        IEmissionFunds _emissionFunds = IEmissionFunds(emissionFunds());
        uint256 amount = _getAmount(_id);

        _setIsFinalized(_id, true);
        _setNoActiveBallotExists(true);
        _setEmissionReleaseTime(
            emissionReleaseTime().add(emissionReleaseThreshold())
        );
        
        emit BallotFinalized(_id, msg.sender);
        
        if (getTotalVoters(_id) < getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint256(QuorumStates.Frozen));
            _emissionFunds.freezeFunds(amount);
            return;
        }

        QuorumStates quorumState = QuorumStates.Frozen;
        uint256 sendVotesCount = _getSendVotes(_id);
        uint256 burnVotesCount = _getBurnVotes(_id);
        uint256 freezeVotesCount = _getFreezeVotes(_id);
        
        if (
            sendVotesCount != burnVotesCount &&
            burnVotesCount != freezeVotesCount &&
            sendVotesCount != freezeVotesCount
        ) {
            uint256 max = _max(sendVotesCount, burnVotesCount, freezeVotesCount);
            if (max == sendVotesCount) quorumState = QuorumStates.Sent;
            else if (max == burnVotesCount) quorumState = QuorumStates.Burnt;
        } else {
            if (
                burnVotesCount == freezeVotesCount &&
                sendVotesCount > burnVotesCount
            ) {
                quorumState = QuorumStates.Sent;
            } else if (
                sendVotesCount == freezeVotesCount &&
                burnVotesCount > sendVotesCount
            ) {
                quorumState = QuorumStates.Burnt;
            }
        }

        _setQuorumState(_id, uint256(quorumState));

        if (quorumState == QuorumStates.Sent) {
            _emissionFunds.sendFundsTo(_getReceiver(_id), amount);
        } else if (quorumState == QuorumStates.Burnt) {
            _emissionFunds.burnFunds(amount);
        } else {
            _emissionFunds.freezeFunds(amount);
        }
    }
    // solhint-enable code-complexity, function-max-lines

    function _getAmount(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, AMOUNT))];
    }

    function _getBurnVotes(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, BURN_VOTES))];
    }

    function _getCreationTime(uint256 _ballotId) internal view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, CREATION_TIME))
        ];
    }

    function _getEmissionReleaseTimeSnapshot(uint256 _ballotId) internal view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, EMISSION_RELEASE_TIME_SNAPSHOT))
        ];
    }

    function _getFreezeVotes(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, FREEZE_VOTES))];
    }

    function _getGlobalMinThresholdOfVoters() internal view returns(uint256) {
        return _getBallotsStorage().getProxyThreshold();
    }

    function _getIsCanceled(uint256 _ballotId) internal view returns(bool) {
        return boolStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, IS_CANCELED))
        ];
    }

    function _getReceiver(uint256 _id) internal view returns(address) {
        return addressStorage[keccak256(abi.encode(VOTING_STATE, _id, RECEIVER))];
    }

    function _getSendVotes(uint256 _id) internal view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, SEND_VOTES))];
    }

    function _isEOA(address addr) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(addr) }
        return size == 0;
    }

    function _max(uint256 a, uint256 b, uint256 c) private pure returns(uint256) {
        uint256 max = a;
        if (b > max) {
            max = b;
        }
        if (c > max) {
            max = c;
        }
        return max;
    }

    function _setAmount(uint256 _ballotId, uint256 _amount) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, AMOUNT))
        ] = _amount;
    }

    function _setBurnVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, BURN_VOTES))
        ] = _value;
    }

    function _setCreationTime(uint256 _ballotId, uint256 _time) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, CREATION_TIME))
        ] = _time;
    }

    function _setEmissionReleaseTime(uint256 _time) private {
        uintStorage[EMISSION_RELEASE_TIME] = _time;
    }

    function _setEmissionReleaseTimeSnapshot(uint256 _ballotId, uint256 _time) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, EMISSION_RELEASE_TIME_SNAPSHOT))
        ] = _time;
    }

    function _setFreezeVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, FREEZE_VOTES))
        ] = _value;
    }

    function _setIsCanceled(uint256 _ballotId, bool _canceled) private {
        boolStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, IS_CANCELED))
        ] = _canceled;
    }

    function _setNoActiveBallotExists(bool _finalized) private {
        boolStorage[NO_ACTIVE_BALLOT_EXISTS] = _finalized;
    }

    function _setReceiver(uint256 _ballotId, address _value) private {
        addressStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, RECEIVER))
        ] = _value;
    }

    function _setSendVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, SEND_VOTES))
        ] = _value;
    }

    function _withinCancelingThreshold(uint256 _ballotId) private view returns(bool) {
        return getTime().sub(_getCreationTime(_ballotId)) <= ballotCancelingThreshold();
    }
}
