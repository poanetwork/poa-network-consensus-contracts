pragma solidity ^0.4.24;

import '../../contracts/RewardByTime.sol';


contract RewardByTimeMock is RewardByTime {
    modifier onlySystem {
        require(msg.sender == addressStorage[keccak256("systemAddress")]);
        _;
    }

    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setSystemAddress(address _address) public {
        addressStorage[keccak256("systemAddress")] = _address;
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }
}