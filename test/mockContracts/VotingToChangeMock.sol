pragma solidity ^0.4.24;

import '../../contracts/interfaces/IProxyStorage.sol';


contract VotingToChangeMock {
    function getBallotLimitPerValidator() public view returns(uint256) {
        return _getBallotLimitPerValidator();
    }

    function getEndTime(uint256 _id) public view returns(uint256) {
        return _getEndTime(_id);
    }

    function getIsFinalized(uint256 _id) public view returns(bool) {
        return _getIsFinalized(_id);
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function getProgress(uint256 _id) public view returns(int) {
        return _getProgress(_id);
    }

    function getStartTime(uint256 _id) public view returns(uint256) {
        return _getStartTime(_id);
    }

    function getTotalVoters(uint256 _id) public view returns(uint256) {
        return _getTotalVoters(_id);
    }

    function hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey)
        public
        view
        returns(bool)
    {
        return _hasMiningKeyAlreadyVoted(_id, _miningKey);
    }

    function proxyStorage() public view returns(address);

    function _getBallotLimitPerValidator() internal view returns(uint256);
    function _getEndTime(uint256) internal view returns(uint256);
    function _getIsFinalized(uint256) internal view returns(bool);
    function _getProgress(uint256) internal view returns(int);
    function _getStartTime(uint256) internal view returns(uint256);
    function _getTotalVoters(uint256) internal view returns(uint256);
    function _hasMiningKeyAlreadyVoted(uint256, address) internal view returns(bool);
}