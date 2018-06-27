pragma solidity ^0.4.24;

import '../../contracts/BlockReward.sol';


contract BlockRewardMock is BlockReward {
    uint256 public time;

    constructor(
        address _proxyStorage,
        address _emissionFunds,
        uint256 _blockRewardAmount,
        uint256 _emissionFundsAmount,
        uint256 _hbbftTimeThreshold
    ) BlockReward(
        _proxyStorage,
        _emissionFunds,
        _blockRewardAmount,
        _emissionFundsAmount,
        _hbbftTimeThreshold
    ) public {
    }

    function setSystemAddress(address _systemAddress) public {
        SYSTEM_ADDRESS = _systemAddress;
    }

    function setTime(uint256 _time) public {
        time = _time;
    }

    function getTime() public view returns(uint256) {
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }
}