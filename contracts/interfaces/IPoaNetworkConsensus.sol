pragma solidity ^0.4.18;


contract IPoaNetworkConsensus {
    bool public finalized = false;
    address public systemAddress;
    address[] public currentValidators;
    address[] public pendingList;
    uint256 public currentValidatorsLength;

    function getValidators() public view returns(address[]);
    function getPendingList() public view returns(address[]);
    function finalizeChange() public;
    function addValidator(address) public;
    function removeValidator(address) public;
    function isValidator(address) public view returns(bool);
}