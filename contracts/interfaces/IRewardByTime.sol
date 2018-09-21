pragma solidity ^0.4.24;


interface IRewardByTime {
    function reward() external returns (address[], uint256[]);
}
