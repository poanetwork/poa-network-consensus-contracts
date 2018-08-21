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
    function getEndTime(uint256) external view returns(uint256);
    function getKeysManager() external view returns(address);
    function getMiningKey(uint256) external view returns(address);
    function getProgress(uint256) external view returns(int256);
    function getBallotType(uint256) external view returns(uint256);
    function getIsFinalized(uint256) external view returns(bool);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
    function getStartTime(uint256) external view returns(uint256);
    function getTotalVoters(uint256) external view returns(uint256);
    function hasAlreadyVoted(uint256, address) external view returns(bool);

    function votingState(uint256) external view returns(
        uint256 startTime,
        uint256 endTime,
        address affectedKey,
        uint256 affectedKeyType,
        address miningKey,
        uint256 totalVoters,
        int progress,
        bool isFinalized,
        uint8 quorumState,
        uint256 ballotType,
        uint256 index,
        uint256 minThresholdOfVoters,
        address creator,
        string memo
    );
}