pragma solidity ^0.4.18;


interface IVotingToChangeKeys {
    function nextBallotId() public view returns(uint256);
    function activeBallots(uint256) public view returns(uint256);
    function activeBallotsLength() public view returns(uint256);
    function validatorActiveBallots(address) public view returns(uint256);
    function getStartTime(uint256) public view returns(uint256);
    function getEndTime(uint256) public view returns(uint256);
    function getAffectedKey(uint256) public view returns(address);
    function getAffectedKeyType(uint256) public view returns(uint256);
    function getMiningKey(uint256) public view returns(address);
    function getTotalVoters(uint256) public view returns(uint256);
    function getProgress(uint256) public view returns(int256);
    function getIsFinalized(uint256) public view returns(bool);
    function getBallotType(uint256) public view returns(uint256);
    function getMinThresholdOfVoters(uint256) public view returns(uint256);
}