pragma solidity ^0.4.24;


interface IVotingToChangeMinThreshold {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}


interface IVotingToChangeMinThresholdPrev {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
    function getProposedValue(uint256) external view returns(uint256);
}