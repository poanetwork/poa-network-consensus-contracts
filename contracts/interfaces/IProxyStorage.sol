pragma solidity ^0.4.18;

contract IProxyStorage {
    address masterOfCeremony;
    address public poaConsensus;
    address public keysManager;
    address public ballotsStorage;
    address public votingToChangeMinThreshold;
    address public votingToChangeKeys;
    address public proxyBallot;
    function getKeysManagerAddress() public view returns(address);
    function getVotingToChangeKeys() public view returns(address);
    function initializeAddresses(address,address,address) public;
}