pragma solidity ^0.4.23;


interface IEmissionFunds {
	function sendFundsTo(address) external returns(bool);
    function burnFunds() external returns(bool);
}