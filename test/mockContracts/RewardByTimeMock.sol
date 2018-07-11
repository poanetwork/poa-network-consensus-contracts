pragma solidity ^0.4.24;

import '../../contracts/RewardByTime.sol';


contract RewardByTimeMock is RewardByTime {
    address internal systemAddress;
    uint256 public time;

    modifier onlySystem {
        require(msg.sender == systemAddress);
        _;
    }

    function getTime() public view returns(uint256) {
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setSystemAddress(address _address) public {
        systemAddress = _address;
    }

    function setTime(uint256 _time) public {
        time = _time;
    }
}