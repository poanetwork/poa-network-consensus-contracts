pragma solidity ^0.4.18;


contract BallotsStorage {
    enum ThresholdTypes {Invalid, Keys, MetadataChange}
    address public votingToChangeThreshold;
    mapping(uint8 => uint256) public ballotThresholds;

    modifier onlyVotingToChangeThreshold() {
        require(msg.sender == votingToChangeThreshold);
        _;
    }
    function BallotsStorage(address _votingToChangeThreshold) public {
        votingToChangeThreshold = _votingToChangeThreshold;
        ballotThresholds[uint8(ThresholdTypes.Keys)] = 3;
        ballotThresholds[uint8(ThresholdTypes.MetadataChange)] = 2;
    }

    function setThreshold(uint256 _newValue, uint8 _thresholdType) public onlyVotingToChangeThreshold {
        require(_thresholdType > 0);
        require(_newValue > 0 && _newValue != ballotThresholds[_thresholdType]);
        ballotThresholds[_thresholdType] = _newValue;
    }
}