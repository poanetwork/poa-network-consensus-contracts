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
    
    bytes32 internal constant PREVIOUS_BALLOT_FINALIZED =
        keccak256("previousBallotFinalized");

    string internal constant AMOUNT = "amount";
    string internal constant BURN_VOTES = "burnVotes";
    string internal constant FREEZE_VOTES = "freezeVotes";
    string internal constant RECEIVER = "receiver";
    string internal constant SEND_VOTES = "sendVotes";

    enum QuorumStates {Invalid, InProgress, Sent, Burnt, Frozen}
    enum ActionChoice {Invalid, Send, Burn, Freeze}

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _receiver,
        string _memo
    ) public onlyValidVotingKey(msg.sender) {
        require(initDisabled());
        require(_startTime > 0 && _endTime > 0);
        uint256 currentTime = getTime();
        require(_endTime > _startTime && _startTime > currentTime);
        uint256 releaseTime = refreshEmissionReleaseTime();
        require(_startTime > releaseTime);
        require(currentTime > releaseTime);
        require(_endTime.sub(releaseTime) <= distributionThreshold());
        require(_receiver != address(0));
        require(previousBallotFinalized());
        uint256 ballotId = _createBallot(
            uint256(BallotTypes.ManageEmissionFunds),
            _startTime,
            _endTime,
            _memo,
            uint8(QuorumStates.InProgress),
            _getMiningByVotingKey(msg.sender)
        );
        _setSendVotes(ballotId, 0);
        _setBurnVotes(ballotId, 0);
        _setFreezeVotes(ballotId, 0);
        _setReceiver(ballotId, _receiver);
        _setAmount(ballotId, emissionFunds().balance);
        _setPreviousBallotFinalized(false);
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
        require(_id < nextBallotId());
        require(_id == nextBallotId().sub(1));
        require(_getStartTime(_id) <= getTime());
        require(!isActive(_id));
        require(!_getIsFinalized(_id));
        require(!previousBallotFinalized());
        _finalize(_id);
    }

    function getAmount(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, AMOUNT))];
    }

    function getBallotInfo(uint256 _id, address _votingKey) public view returns(
        uint256 startTime,
        uint256 endTime,
        bool isFinalized,
        address creator,
        string memo,
        bool hasAlreadyVoted,
        uint256 amount,
        uint256 burnVotes,
        uint256 freezeVotes,
        uint256 sendVotes,
        address receiver
    ) {
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        isFinalized = _getIsFinalized(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
        hasAlreadyVoted = this.hasAlreadyVoted(_id, _votingKey);
        amount = getAmount(_id);
        burnVotes = getBurnVotes(_id);
        freezeVotes = getFreezeVotes(_id);
        sendVotes = getSendVotes(_id);
        receiver = getReceiver(_id);
    }

    function getBurnVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, BURN_VOTES))];
    }

    function getFreezeVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, FREEZE_VOTES))];
    }

    function getReceiver(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(abi.encode(VOTING_STATE, _id, RECEIVER))];
    }

    function getSendVotes(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(VOTING_STATE, _id, SEND_VOTES))];
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return getSendVotes(_id).add(getBurnVotes(_id)).add(getFreezeVotes(_id));
    }

    function init(
        address _emissionFunds,
        uint256 _emissionReleaseTime,
        uint256 _emissionReleaseThreshold,
        uint256 _distributionThreshold
    ) public onlyOwner {
        require(!initDisabled());
        require(_emissionFunds != address(0));
        require(_emissionReleaseTime > getTime());
        require(_emissionReleaseThreshold > 0);
        require(_distributionThreshold > 0);
        require(_emissionReleaseThreshold > _distributionThreshold);
        _setPreviousBallotFinalized(true);
        _setEmissionReleaseTime(_emissionReleaseTime);
        addressStorage[EMISSION_FUNDS] = _emissionFunds;
        uintStorage[EMISSION_RELEASE_THRESHOLD] = _emissionReleaseThreshold;
        uintStorage[DISTRIBUTION_THRESHOLD] = _distributionThreshold;
        boolStorage[INIT_DISABLED] = true;
    }

    function previousBallotFinalized() public view returns(bool) {
        return boolStorage[PREVIOUS_BALLOT_FINALIZED];
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

    function vote(uint256 _id, uint8 _choice) public onlyValidVotingKey(msg.sender) {
        require(!_getIsFinalized(_id));
        require(isValidVote(_id, msg.sender));
        if (_choice == uint(ActionChoice.Send)) {
            _setSendVotes(_id, getSendVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Burn)) {
            _setBurnVotes(_id, getBurnVotes(_id).add(1));
        } else if (_choice == uint(ActionChoice.Freeze)) {
            _setFreezeVotes(_id, getFreezeVotes(_id).add(1));
        } else {
            revert();
        }
        address miningKey = _getMiningByVotingKey(msg.sender);
        _votersAdd(_id, miningKey);
        emit Vote(_id, _choice, msg.sender, getTime(), miningKey);

        uint256 validatorsLength = IPoaNetworkConsensus(
            IProxyStorage(proxyStorage()).getPoaConsensus()
        ).getCurrentValidatorsLengthWithoutMoC();
        
        if (getTotalVoters(_id) >= validatorsLength) {
            _finalize(_id);
        }
    }

    // solhint-disable code-complexity, function-max-lines
    function _finalize(uint256 _id) internal {
        IEmissionFunds _emissionFunds = IEmissionFunds(emissionFunds());
        uint256 amount = getAmount(_id);

        _setIsFinalized(_id, true);
        _setPreviousBallotFinalized(true);
        _setEmissionReleaseTime(
            emissionReleaseTime().add(emissionReleaseThreshold())
        );
        
        emit BallotFinalized(_id, msg.sender);
        
        if (getTotalVoters(_id) < getMinThresholdOfVoters(_id)) {
            _setQuorumState(_id, uint8(QuorumStates.Frozen));
            _emissionFunds.freezeFunds(amount);
            return;
        }

        QuorumStates quorumState = QuorumStates.Frozen;
        uint256 sendVotesCount = getSendVotes(_id);
        uint256 burnVotesCount = getBurnVotes(_id);
        uint256 freezeVotesCount = getFreezeVotes(_id);
        
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

        _setQuorumState(_id, uint8(quorumState));

        if (quorumState == QuorumStates.Sent) {
            _emissionFunds.sendFundsTo(getReceiver(_id), amount);
        } else if (quorumState == QuorumStates.Burnt) {
            _emissionFunds.burnFunds(amount);
        } else {
            _emissionFunds.freezeFunds(amount);
        }
    }
    // solhint-enable code-complexity, function-max-lines

    function _getGlobalMinThresholdOfVoters() internal view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(_getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
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

    function _setEmissionReleaseTime(uint256 _time) private {
        uintStorage[EMISSION_RELEASE_TIME] = _time;
    }

    function _setFreezeVotes(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, FREEZE_VOTES))
        ] = _value;
    }

    function _setPreviousBallotFinalized(bool _finalized) private {
        boolStorage[PREVIOUS_BALLOT_FINALIZED] = _finalized;
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
}
