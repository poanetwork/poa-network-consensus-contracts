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
        startTime = _getStartTime(_id);
        endTime = _getEndTime(_id);
        totalVoters = _getTotalVoters(_id);
        progress = _getProgress(_id);
        isFinalized = _getIsFinalized(_id);
        proposedValue = _getProposedValue(_id);
        contractType = _getContractType(_id);
        creator = _getCreator(_id);
        memo = _getMemo(_id);
        canBeFinalizedNow = _canBeFinalizedNow(_id);
        hasAlreadyVoted = this.hasAlreadyVoted(_id, _votingKey);
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
        IVotingToChangeProxyAddressPrev prev =
            IVotingToChangeProxyAddressPrev(_prevVotingToChange);
        _setProposedValue(_id, prev.getProposedValue(_id));
        _setContractType(_id, prev.getContractType(_id));
    }

    function _finalizeBallotInner(uint256 _id) internal returns(bool) {
        return IProxyStorage(proxyStorage()).setContractAddress(
            _getContractType(_id),
            _getProposedValue(_id)
        );
    }

    function _getContractType(uint256 _id) internal view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(VOTING_STATE, _id, CONTRACT_TYPE))
        ];
    }

    function _getGlobalMinThresholdOfVoters() internal view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(_getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
    }

    function _getProposedValue(uint256 _id) internal view returns(address) {
        return addressStorage[
            keccak256(abi.encode(VOTING_STATE, _id, PROPOSED_VALUE))
        ];
    }

    function _setContractType(uint256 _ballotId, uint256 _value) private {
        uintStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, CONTRACT_TYPE))
        ] = _value;
    }

    function _setProposedValue(uint256 _ballotId, address _value) private {
        addressStorage[
            keccak256(abi.encode(VOTING_STATE, _ballotId, PROPOSED_VALUE))
        ] = _value;
    }

}
