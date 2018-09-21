pragma solidity ^0.4.24;


contract EnumBallotTypes {
    enum BallotTypes {
        Invalid,
        KeyAdding,
        KeyRemoval,
        KeySwap,
        MinThreshold,
        ProxyAddress,
        ManageEmissionFunds
    }
}