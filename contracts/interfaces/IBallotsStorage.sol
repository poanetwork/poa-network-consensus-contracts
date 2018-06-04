pragma solidity ^0.4.24;


interface IBallotsStorage {
    function setThreshold(uint256, uint8) external;
    function getBallotThreshold(uint8) external view returns(uint256);
    function getVotingToChangeThreshold() external view returns(address);
    function getProxyThreshold() external view returns(uint256);
    function getBallotLimitPerValidator() external view returns(uint256);
    function getMaxLimitBallot() external view returns(uint256);
}