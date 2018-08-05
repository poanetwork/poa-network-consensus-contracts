pragma solidity ^0.4.24;

import './VotingToChangeMock.sol';
import '../../contracts/VotingToChangeProxyAddress.sol';


contract VotingToChangeProxyAddressMock is VotingToChangeMock, VotingToChangeProxyAddress {
    function getContractType(uint256 _id) public view returns(uint256) {
        return _getContractType(_id);
    }

    function getProposedValue(uint256 _id) public view returns(address) {
        return _getProposedValue(_id);
    }

    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }
}