pragma solidity ^0.4.23;


interface IEmissionFunds {
    function sendFundsTo(address, uint256) external returns(bool);
    function burnFunds(uint256) external returns(bool);
}