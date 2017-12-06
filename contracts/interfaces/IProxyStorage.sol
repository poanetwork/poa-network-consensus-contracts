pragma solidity ^0.4.18;


interface IProxyStorage {
    function getKeysManager() public view returns(address);
    function getBallotsStorage() public view returns(address);
    function getVotingToChangeKeys() public view returns(address);
    function getVotingToChangeMinThreshold() public view returns(address);
    function getPoaConsensus() public view returns(address);
    function initializeAddresses(address, address, address, address, address) public;
    function setContractAddress(uint256, address) public;
}