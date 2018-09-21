pragma solidity ^0.4.24;

import '../../contracts/VotingToManageEmissionFunds.sol';


contract VotingToManageEmissionFundsMock is VotingToManageEmissionFunds {
    function getAmount(uint256 _id) public view returns(uint256) {
        return _getAmount(_id);
    }

    function getEmissionReleaseTimeSnapshot(uint256 _ballotId) public view returns(uint256) {
        return _getEmissionReleaseTimeSnapshot(_ballotId);
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey)
        public
        view
        returns(bool)
    {
        return _hasMiningKeyAlreadyVoted(_id, _miningKey);
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }
}