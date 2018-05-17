pragma solidity ^0.4.23;


interface IKeysManager {
    function initialKeysCount() external view returns(uint256);
    function initiateKeys(address) external;
    function createKeys(address, address, address) external;
    function isMiningActive(address) external view returns(bool);
    function isVotingActive(address) external view returns(bool);
    function isPayoutActive(address) external view returns(bool);
    function getVotingByMining(address) external view returns(address);
    function getPayoutByMining(address) external view returns(address);
    function addMiningKey(address) external;
    function addVotingKey(address, address) external;
    function addPayoutKey(address, address) external;
    function removeMiningKey(address) external;
    function removeVotingKey(address) external;
    function removePayoutKey(address) external;
    function swapMiningKey(address, address) external;
    function swapVotingKey(address, address) external;
    function swapPayoutKey(address, address) external;
    function getTime() external view returns(uint256);
    function getMiningKeyHistory(address) external view returns(address);
    function getMiningKeyByVoting(address) external view returns(address);
    function getInitialKey(address) external view returns(uint8);
    function migrateInitialKey(address) external;
    function migrateMiningKey(address) external;
}