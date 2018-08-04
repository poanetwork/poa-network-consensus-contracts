pragma solidity ^0.4.24;


interface IVotingToChange {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}


interface IVotingToChangePrev {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getStartTime(uint256) external view returns(uint256);
    function getEndTime(uint256) external view returns(uint256);
    function getTotalVoters(uint256) external view returns(uint256);
    function getProgress(uint256) external view returns(int256);
    function getIsFinalized(uint256) external view returns(bool);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}