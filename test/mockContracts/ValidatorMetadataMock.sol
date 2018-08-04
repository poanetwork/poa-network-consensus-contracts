pragma solidity ^0.4.24;

import '../../contracts/ValidatorMetadata.sol';


contract ValidatorMetadataMock is ValidatorMetadata {
    function getTime() public view returns(uint256) {
        uint256 time = uintStorage[keccak256("mockTime")];
        if (time == 0) {
            return now;
        } else {
            return time;
        }
    }

    function setTime(uint256 _newTime) public {
        uintStorage[keccak256("mockTime")] = _newTime;
    }
}