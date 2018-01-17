pragma solidity ^0.4.18;


interface IPoaNetworkConsensus {
    function getValidators() public view returns(address[]);
    function getPendingList() public view returns(address[]);
    function finalizeChange() public;
    function addValidator(address, bool) public;
    function removeValidator(address, bool) public;
    function isValidator(address) public view returns(bool);
    function getCurrentValidatorsLength() public view returns(uint256);
    function swapValidatorKey(address, address) public;
}