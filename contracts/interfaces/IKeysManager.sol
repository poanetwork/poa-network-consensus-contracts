pragma solidity ^0.4.24;


interface IKeysManager {
    function addMiningKey(address) external returns(bool);
    function addVotingKey(address, address) external returns(bool);
    function addPayoutKey(address, address) external returns(bool);
    function createKeys(address, address, address) external;
    function initiateKeys(address) external;
    function migrateInitialKey(address) external;
    function migrateMiningKey(address) external;
    function removeMiningKey(address) external returns(bool);
    function removeVotingKey(address) external returns(bool);
    function removePayoutKey(address) external returns(bool);
    function swapMiningKey(address, address) external returns(bool);
    function swapVotingKey(address, address) external returns(bool);
    function swapPayoutKey(address, address) external returns(bool);
    function checkIfMiningExisted(address, address) external view returns(bool);
    function initialKeysCount() external view returns(uint256);
    function isMiningActive(address) external view returns(bool);
    function isVotingActive(address) external view returns(bool);
    function isPayoutActive(address) external view returns(bool);
    function getVotingByMining(address) external view returns(address);
    function getPayoutByMining(address) external view returns(address);
    function getTime() external view returns(uint256);
    function getMiningKeyHistory(address) external view returns(address);
    function getMiningKeyByVoting(address) external view returns(address);
    function getInitialKeyStatus(address) external view returns(uint8);
    function masterOfCeremony() external view returns(address);
    function maxOldMiningKeysDeepCheck() external pure returns(uint8);
    function miningKeyByPayout(address) external view returns(address);
    function miningKeyByVoting(address) external view returns(address);
}


interface IKeysManagerPrev {
    function getInitialKey(address) external view returns(uint8);
}