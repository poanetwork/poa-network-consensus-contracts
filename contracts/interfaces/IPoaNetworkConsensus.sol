pragma solidity ^0.4.24;


interface IPoaNetworkConsensus {
    function addValidator(address, bool) external returns(bool);
    function finalizeChange() external;
    function removeValidator(address, bool) external returns(bool);
    function swapValidatorKey(address, address) external returns(bool);
    function isMasterOfCeremonyRemoved() external view returns(bool);
    function isValidator(address) external view returns(bool);
    function getCurrentValidatorsLength() external view returns(uint256);
    function getCurrentValidatorsLengthWithoutMoC() external view returns(uint256);
    function getPendingList() external view returns(address[]);
    function getValidators() external view returns(address[]);
    function masterOfCeremony() external view returns(address);
}


interface IPoaNetworkConsensusForVotingToChange {
    function currentValidators(uint256) external view returns(address);
    function getCurrentValidatorsLength() external view returns(uint256);
}