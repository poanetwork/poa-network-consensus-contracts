pragma solidity ^0.4.18;


interface IEmissionFunds {
	function sendFundsTo(address) external returns(bool);
    function burnFunds() external returns(bool);
}