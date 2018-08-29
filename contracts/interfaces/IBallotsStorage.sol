pragma solidity ^0.4.24;


interface IBallotsStorage {
    function setThreshold(uint256, uint256) external returns(bool);
    function areKeysBallotParamsValid(uint256, address, uint256, address) external view returns(bool);
    function getBallotThreshold(uint256) external view returns(uint256);
    function getVotingToChangeThreshold() external view returns(address);
    function getProxyThreshold() external view returns(uint256);
    function getBallotLimitPerValidator() external view returns(uint256);
    function getMaxLimitBallot() external view returns(uint256);
    function metadataChangeConfirmationsLimit() external pure returns(uint256);
}


interface IBallotsStoragePrev {
    function getBallotThreshold(uint8) external view returns(uint256);
}