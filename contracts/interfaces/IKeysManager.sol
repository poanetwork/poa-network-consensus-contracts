pragma solidity ^0.4.18;


contract IKeysManager {
    address public masterOfCeremony;
    address public poaNetworkConsensus;
    uint256 public maxNumberOfInitialKeys;
    uint256 public initialKeysCount;
    uint256 public maxLimitValidators;
    mapping(address => uint8) public initialKeys;
    mapping(address => address) public getMiningKeyByVoting;
    mapping(address => address) public miningKeyHistory;

    function initiateKeys(address) public;
    function createKeys(address, address, address) public;
    function isMiningActive(address) public view returns(bool);
    function isVotingActive(address) public view returns(bool);
    function isPayoutActive(address) public view returns(bool);
    function getVotingByMining(address) public view returns(address);
    function getPayoutByMining(address) public view returns(address);
    function addMiningKey(address) public;
    function addVotingKey(address, address) public;
    function addPayoutKey(address, address) public;
    function removeMiningKey(address) public;
    function removeVotingKey(address) public;
    function removePayoutKey(address) public;
    function swapMiningKey(address, address) public;
    function swapVotingKey(address, address) public;
    function swapPayoutKey(address, address) public;
    function getTime() public view returns(uint256);
}