pragma solidity ^0.4.23;


interface IProxyStorage {
    function initializeAddresses(address, address, address, address, address, address) external;
    function setContractAddress(uint256, address) external;
    function isValidator(address) external view returns(bool);
    function getBallotsStorage() external view returns(address);
    function getKeysManager() external view returns(address);
    function getPoaConsensus() external view returns(address);
    function getVotingToChangeKeys() external view returns(address);
    function getVotingToChangeMinThreshold() external view returns(address);
}