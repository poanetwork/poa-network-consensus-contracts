pragma solidity ^0.4.24;


interface IVotingToChangeKeys {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}


interface IVotingToChangeKeysPrev {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getAffectedKey(uint256) external view returns(address);
    function getAffectedKeyType(uint256) external view returns(uint256);
    function getMiningKey(uint256) external view returns(address);
    function getBallotType(uint256) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}