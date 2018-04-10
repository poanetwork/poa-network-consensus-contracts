pragma solidity ^0.4.18;
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./SafeMath.sol";


contract BallotsStorage is IBallotsStorage {
    using SafeMath for uint256;

    enum ThresholdTypes {Invalid, Keys, MetadataChange}
    event ThresholdChanged(uint8 indexed thresholdType, uint256 newValue);
    IProxyStorage public proxyStorage;
    mapping(uint8 => uint256) ballotThresholds;

    modifier onlyVotingToChangeThreshold() {
        require(msg.sender == getVotingToChangeThreshold());
        _;
    }

    function BallotsStorage(address _proxyStorage, bool _demoMode) public {
        proxyStorage = IProxyStorage(_proxyStorage);
        ballotThresholds[uint8(ThresholdTypes.Keys)] = _demoMode ? 1 : 3;
        ballotThresholds[uint8(ThresholdTypes.MetadataChange)] = _demoMode ? 1 : 2;
    }

    function setThreshold(uint256 _newValue, uint8 _thresholdType) public onlyVotingToChangeThreshold {
        require(_thresholdType > 0);
        require(_thresholdType <= uint8(ThresholdTypes.MetadataChange));
        require(_newValue > 0 && _newValue != ballotThresholds[_thresholdType]);
        ballotThresholds[_thresholdType] = _newValue;
        ThresholdChanged(_thresholdType, _newValue);
    }

    function getBallotThreshold(uint8 _ballotType) public view returns(uint256) {
        return ballotThresholds[_ballotType];
    }

    function getVotingToChangeThreshold() public view returns(address) {
        return proxyStorage.getVotingToChangeMinThreshold();
    }

    function getTotalNumberOfValidators() public view returns(uint256) {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(proxyStorage.getPoaConsensus());
        return poa.getCurrentValidatorsLength();
    }

    function getProxyThreshold() public view returns(uint256) {
        uint256 validatorsCount = getTotalNumberOfValidators().sub(1);
        return validatorsCount.div(2).add(1);
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        uint256 validatorsCount = getTotalNumberOfValidators().sub(1);
        if (validatorsCount == 0) {
            return getMaxLimitBallot();
        }
        return getMaxLimitBallot().div(validatorsCount);
    }
    
    function getMaxLimitBallot() public view returns(uint256) {
        return 200;
    }
}