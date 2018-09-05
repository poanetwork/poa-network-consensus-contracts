pragma solidity ^0.4.24;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IVotingToChangeProxyAddressPrev.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeProxyAddress is VotingToChange {
    bytes32 internal constant CONTRACT_TYPE = "contractType";
    bytes32 internal constant PROPOSED_VALUE = "proposedValue";

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        uint256 _contractType,
        string _memo,
        address _proposedValue
    ) public {
        require(_proposedValue != address(0));
        uint256 ballotId = super._createBallot(
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
        bool alreadyVoted
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
        alreadyVoted = hasAlreadyVoted(_id, _votingKey);
    }

    function migrateBasicOne(
        uint256 _id,
        address _prevVotingToChange,
        address[] _voters
    ) public {
        require(_prevVotingToChange != address(0));
        require(initDisabled());
        require(!migrateDisabled());
        IVotingToChangeProxyAddressPrev prev =
            IVotingToChangeProxyAddressPrev(_prevVotingToChange);
        require(prev.getTotalVoters(_id) == _voters.length);

        uint256 endTime = prev.getEndTime(_id);

        _setTotalVoters(_id, _voters.length);
        _setIsFinalized(_id, prev.getIsFinalized(_id));
        _setMinThresholdOfVoters(_id, prev.getMinThresholdOfVoters(_id));
        _setStartTime(_id, prev.getStartTime(_id));
        _setEndTime(_id, endTime);

        // solhint-disable indent
        (
            , , ,
            int progress, ,
            uint8 quorumState,
            uint256 index, , , ,
            address creator,
            string memory memo
        ) = prev.votingState(_id);
        // solhint-enable indent
        _setProgress(_id, progress);
        _setQuorumState(_id, quorumState);
        _setIndex(_id, index);
        _setCreator(_id, creator);
        _setMemo(_id, memo);
        
        _setProposedValue(_id, prev.getProposedValue(_id));
        _setContractType(_id, prev.getContractType(_id));

        IKeysManager prevKeysManager = IKeysManager(prev.getKeysManager());
        for (uint256 i = 0; i < _voters.length; i++) {
            if (getTime() <= endTime) {
                require(prev.hasAlreadyVoted(_id, prevKeysManager.getVotingByMining(_voters[i])));
            }
            _votersAdd(_id, _voters[i]);
        }
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
        return _getBallotsStorage().getProxyThreshold();
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
