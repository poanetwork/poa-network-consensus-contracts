pragma solidity ^0.4.18;


contract IPoaNetworkConsensus {
    bool public finalized = false;
    address public systemAddress;
    address[] public currentValidators;
    address[] public pendingList;
    address public keysManager;
    address public votingContract;
    uint256 public currentValidatorsLength;

    function getValidators() public view returns(address[]);

    function finalizeChange() public;

    function addValidator(address) public;

    function removeValidator(address) public;

    function setKeysManager(address) public;

    function setVotingContract(address) public;

    function isValidator(address) public view returns(bool);
}