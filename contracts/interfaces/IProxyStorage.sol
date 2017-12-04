pragma solidity ^0.4.18;


contract IProxyStorage {
    address masterOfCeremony;
    address public poaConsensus;
    address public keysManager;
    address public ballotsStorage;
    address public votingToChangeMinThreshold;
    address public votingToChangeKeys;
    address public proxyBallot;
    function getKeysManager() public view returns(address);
    function getBallotsStorage() public view returns(address);
    function getVotingToChangeKeys() public view returns(address);
    function getVotingToChangeMinThreshold() public view returns(address);
    function initializeAddresses(address,address,address,address) public;
}