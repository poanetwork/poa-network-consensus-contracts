pragma solidity ^0.4.24;

import '../../contracts/ValidatorMetadata.sol';


contract ValidatorMetadataMock is ValidatorMetadata {
    uint256 public time;

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