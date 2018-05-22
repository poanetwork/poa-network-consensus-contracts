pragma solidity ^0.4.23;

import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";
import "./libs/SafeMath.sol";


contract BallotsStorage is EternalStorage, IBallotsStorage {
    using SafeMath for uint256;

    bytes32 internal constant INIT_DISABLED = keccak256("initDisabled");
    bytes32 internal constant OWNER = keccak256("owner");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");

    string internal constant BALLOT_THRESHOLDS = "ballotThresholds";

    enum ThresholdTypes {Invalid, Keys, MetadataChange}
    event ThresholdChanged(uint8 indexed thresholdType, uint256 newValue);

    modifier onlyOwner() {
        require(msg.sender == addressStorage[OWNER]);
        _;
    }

    modifier onlyVotingToChangeThreshold() {
        require(msg.sender == getVotingToChangeThreshold());
        _;
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[PROXY_STORAGE];
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[INIT_DISABLED];
    }

    function init(
        uint256[] _thresholds
    ) public onlyOwner {
        require(!initDisabled());
        require(_thresholds.length == uint256(ThresholdTypes.MetadataChange));
        require(_thresholds.length <= 255);
        for (uint8 thresholdType = 1; thresholdType <= _thresholds.length; thresholdType++) {
            uint256 thresholdValue = _thresholds[thresholdType - 1];
            require(thresholdValue > 0);
            _setThreshold(thresholdValue, thresholdType);
        }
        _initDisable();
    }

    function migrate(address _prevBallotsStorage) public onlyOwner {
        require(_prevBallotsStorage != address(0));
        require(!initDisabled());
        uint8 thresholdKeysType = uint8(ThresholdTypes.Keys);
        uint8 thresholdMetadataType = uint8(ThresholdTypes.MetadataChange);
        IBallotsStorage prevBallotsStorage = IBallotsStorage(_prevBallotsStorage);
        _setThreshold(
            prevBallotsStorage.getBallotThreshold(thresholdKeysType),
            thresholdKeysType
        );
        _setThreshold(
            prevBallotsStorage.getBallotThreshold(thresholdMetadataType),
            thresholdMetadataType
        );
        _initDisable();
    }

    function setThreshold(uint256 _newValue, uint8 _thresholdType)
        public
        onlyVotingToChangeThreshold
    {
        require(_thresholdType > 0);
        require(_thresholdType <= uint8(ThresholdTypes.MetadataChange));
        require(_newValue > 0);
        require(_newValue != getBallotThreshold(_thresholdType));
        _setThreshold(_newValue, _thresholdType);
        emit ThresholdChanged(_thresholdType, _newValue);
    }

    function getBallotThreshold(uint8 _ballotType) public view returns(uint256) {
        return uintStorage[keccak256(BALLOT_THRESHOLDS, _ballotType)];
    }

    function getVotingToChangeThreshold() public view returns(address) {
        return IProxyStorage(proxyStorage()).getVotingToChangeMinThreshold();
    }

    function getTotalNumberOfValidators() public view returns(uint256) {
        IProxyStorage proxy = IProxyStorage(proxyStorage());
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(proxy.getPoaConsensus());
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

    function _initDisable() private {
        boolStorage[INIT_DISABLED] = true;
    }

    function _setThreshold(uint256 _newValue, uint8 _thresholdType) private {
        uintStorage[keccak256(BALLOT_THRESHOLDS, _thresholdType)] = _newValue;
    }
}