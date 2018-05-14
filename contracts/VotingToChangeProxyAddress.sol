pragma solidity ^0.4.18;

import "./interfaces/IProxyStorage.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IVotingToChangeProxyAddress.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeProxyAddress is IVotingToChangeProxyAddress, VotingToChange {
    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _proposedValue,
        uint8 _contractType,
        string memo
    ) public {
        require(_proposedValue != address(0));
        uint256 ballotType = 5;
        uint256 ballotId = _createBallot(ballotType, _startTime, _endTime, memo);
        _setProposedValue(ballotId, _proposedValue);
        _setContractType(ballotId, _contractType);
    }

    function getContractType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "contractType")];
    }
    
    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getProxyThreshold();
    }

    function getProposedValue(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "proposedValue")];
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

    function _finalizeBallotInner(uint256 _id) private {
        IProxyStorage(proxyStorage()).setContractAddress(
            getContractType(_id),
            getProposedValue(_id)
        );
    }

    function _setContractType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "contractType")] = _value;
    }

    function _setProposedValue(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "proposedValue")] = _value;
    }

}
