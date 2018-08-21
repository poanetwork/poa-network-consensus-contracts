pragma solidity ^0.4.24;


interface IVotingToChangeProxyAddress {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
}


interface IVotingToChangeProxyAddressPrev {
    function nextBallotId() external view returns(uint256);
    function activeBallots(uint256) external view returns(uint256);
    function activeBallotsLength() external view returns(uint256);
    function validatorActiveBallots(address) external view returns(uint256);
    function getEndTime(uint256) external view returns(uint256);
    function getIsFinalized(uint256) external view returns(bool);
    function getKeysManager() external view returns(address);
    function getMinThresholdOfVoters(uint256) external view returns(uint256);
    function getProposedValue(uint256) external view returns(address);
    function getContractType(uint256) external view returns(uint256);
    function getStartTime(uint256) external view returns(uint256);
    function getTotalVoters(uint256) external view returns(uint256);
    function hasAlreadyVoted(uint256, address) external view returns(bool);

    function votingState(uint256) external view returns(
        uint256 startTime,
        uint256 endTime,
        uint256 totalVoters,
        int progress,
        bool isFinalized,
        uint8 quorumState,
        uint256 index,
        uint256 minThresholdOfVoters,
        address proposedValue,
        uint8 contractType,
        address creator,
        string memo
    );
}