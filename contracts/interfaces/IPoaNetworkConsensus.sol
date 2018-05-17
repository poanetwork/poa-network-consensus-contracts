pragma solidity ^0.4.23;


interface IPoaNetworkConsensus {
    function getValidators() external view returns(address[]);
    function getPendingList() external view returns(address[]);
    function finalizeChange() external;
    function addValidator(address, bool) external;
    function removeValidator(address, bool) external;
    function isValidator(address) external view returns(bool);
    function getCurrentValidatorsLength() external view returns(uint256);
    function swapValidatorKey(address, address) external;
}


interface IPoaNetworkConsensusForVotingToChange {
    function currentValidators(uint256) external view returns(address);
    function getCurrentValidatorsLength() external view returns(uint256);
}