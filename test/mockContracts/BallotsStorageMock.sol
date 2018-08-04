pragma solidity ^0.4.24;

import '../../contracts/BallotsStorage.sol';


contract BallotsStorageMock is BallotsStorage {
    function setThresholdMock(uint256 _newValue, uint8 _thresholdType) public {
        _setThreshold(_newValue, _thresholdType);
    }
}