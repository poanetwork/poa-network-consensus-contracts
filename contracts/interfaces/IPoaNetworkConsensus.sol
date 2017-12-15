pragma solidity ^0.4.18;


interface IPoaNetworkConsensus {
    function getValidators() public view returns(address[]);
    function getPendingList() public view returns(address[]);
    function finalizeChange() public;
    function addValidator(address) public;
    function removeValidator(address) public;
    function isValidator(address) public view returns(bool);
    function getCurrentValidatorsLength() public view returns(uint256);
}