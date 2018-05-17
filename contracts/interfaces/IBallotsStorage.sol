pragma solidity ^0.4.23;


interface IBallotsStorage {
    function setThreshold(uint256, uint8) external;
    function getBallotThreshold(uint8) external view returns(uint256);
    function getVotingToChangeThreshold() external view returns(address);
    function getTotalNumberOfValidators() external view returns(uint256);
    function getProxyThreshold() external view returns(uint256);
    function getBallotLimitPerValidator() external view returns(uint256);
    function getMaxLimitBallot() external view returns(uint256);
}