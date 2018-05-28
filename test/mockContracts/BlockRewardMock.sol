pragma solidity ^0.4.24;

import '../../contracts/BlockReward.sol';


contract BlockRewardMock is BlockReward {
    constructor(
        address _proxyStorage,
        address _emissionFunds,
        uint256 _blockRewardAmount,
        uint256 _emissionFundsAmount
    ) BlockReward(
        _proxyStorage,
        _emissionFunds,
        _blockRewardAmount,
        _emissionFundsAmount
    ) public {
    }

    function setSystemAddress(address _systemAddress) public {
        SYSTEM_ADDRESS = _systemAddress;
    }
}