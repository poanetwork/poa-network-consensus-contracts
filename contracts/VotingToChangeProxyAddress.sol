pragma solidity ^0.4.24;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IVotingToChangeProxyAddress.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeProxyAddress is IVotingToChangeProxyAddress, VotingToChange {
    string internal constant CONTRACT_TYPE = "contractType";
    string internal constant PROPOSED_VALUE = "proposedValue";

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _proposedValue,
        uint8 _contractType,
        string _memo
    ) public {
        require(_proposedValue != address(0));
        uint256 ballotId = _createBallot(
            uint256(BallotTypes.ProxyAddress),
            _startTime,
            _endTime,
            _memo
        );
        _setProposedValue(ballotId, _proposedValue);
        _setContractType(ballotId, _contractType);
    }

    function getBallotInfo(uint256 _id, address _votingKey) public view returns(
        uint256 startTime,
        uint256 endTime,
        uint256 totalVoters,
        int256 progress,
        bool isFinalized,
        address proposedValue,
        uint256 contractType,
        address creator,
        string memo,
        bool canBeFinalizedNow,
        bool hasAlreadyVoted
    ) {
        startTime = getStartTime(_id);
        endTime = getEndTime(_id);
        totalVoters = getTotalVoters(_id);
        progress = getProgress(_id);
        isFinalized = getIsFinalized(_id);
        proposedValue = getProposedValue(_id);
        contractType = getContractType(_id);
        creator = getCreator(_id);
        memo = getMemo(_id);
        canBeFinalizedNow = _canBeFinalizedNow(_id);
        hasAlreadyVoted = this.hasAlreadyVoted(_id, _votingKey);
    }

    function getContractType(uint256 _id) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, CONTRACT_TYPE))
        ];
    }
    
    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
    }

    function getProposedValue(uint256 _id) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, PROPOSED_VALUE))
        ];
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
        IVotingToChangeProxyAddress prev =
            IVotingToChangeProxyAddress(_prevVotingToChange);
        _setProposedValue(_id, prev.getProposedValue(_id));
        _setContractType(_id, prev.getContractType(_id));
    }

    function _finalizeBallotInner(uint256 _id) internal {
        IProxyStorage(proxyStorage()).setContractAddress(
            getContractType(_id),
            getProposedValue(_id)
        );
    }

    function _setContractType(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, CONTRACT_TYPE))
        ] = _value;
    }

    function _setProposedValue(uint256 _ballotId, address _value) private {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, PROPOSED_VALUE))
        ] = _value;
    }

}
