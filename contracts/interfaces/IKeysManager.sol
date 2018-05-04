pragma solidity ^0.4.18;


interface IKeysManager {
    function initialKeysCount() public view returns(uint256);
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
    function getMiningKeyHistory(address) public view returns(address);
    function getMiningKeyByVoting(address) public view returns(address);
    function getInitialKey(address) public view returns(uint8);
    function migrateInitialKey(address) public;
    function migrateMiningKey(address) public;
}