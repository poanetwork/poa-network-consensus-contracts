pragma solidity ^0.4.24;

import '../../contracts/BallotsStorage.sol';


contract BallotsStorageMock is BallotsStorage {
	function getBallotThreshold(uint8 _ballotType) public view returns(uint256) {
    	return uintStorage[keccak256(abi.encode(BALLOT_THRESHOLDS, _ballotType))];
    }
    
    function metadataChangeConfirmationsLimit() public pure returns(uint256) {
        return 2;
    }

    function setThresholdMock(uint256 _newValue, uint256 _thresholdType) public {
        _setThreshold(_newValue, _thresholdType);
    }
}