pragma solidity ^0.4.23;


interface IBlockReward {
    // Produce rewards for the given benefactors, with corresponding reward codes.
    // Only callable by `SYSTEM_ADDRESS`
    function reward(address[], uint16[]) external returns (address[], uint256[]);
}
