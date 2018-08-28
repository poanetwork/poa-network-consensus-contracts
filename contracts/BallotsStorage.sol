pragma solidity ^0.4.24;

import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";
import "./abstracts/EnumBallotTypes.sol";
import "./abstracts/EnumKeyTypes.sol";
import "./abstracts/EnumThresholdTypes.sol";
import "./libs/SafeMath.sol";


contract BallotsStorage is EternalStorage, EnumBallotTypes, EnumKeyTypes, EnumThresholdTypes, IBallotsStorage {
    using SafeMath for uint256;

    bytes32 internal constant INIT_DISABLED = keccak256("initDisabled");
    bytes32 internal constant OWNER = keccak256("owner");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");

    bytes32 internal constant BALLOT_THRESHOLDS = "ballotThresholds";

    event ThresholdChanged(uint256 indexed thresholdType, uint256 newValue);

    modifier onlyOwner() {
        require(msg.sender == addressStorage[OWNER]);
        _;
    }

    modifier onlyVotingToChangeThreshold() {
        require(msg.sender == getVotingToChangeThreshold());
        _;
    }

    function areKeysBallotParamsValid(
        uint256 _ballotType,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) external view returns(bool) {
        require(_ballotType >= uint256(BallotTypes.KeyAdding));
        require(_ballotType <= uint256(BallotTypes.KeySwap));
        require(_affectedKey != address(0));
        require(_affectedKeyType >= uint256(KeyTypes.MiningKey));
        require(_affectedKeyType <= uint256(KeyTypes.PayoutKey));

        if (_ballotType == uint256(BallotTypes.KeyAdding)) {
            return _areKeyAddingBallotParamsValid(
                _affectedKey,
                _affectedKeyType, 
                _miningKey
            );
        }
        if (_ballotType == uint256(BallotTypes.KeyRemoval)) {
            return _areKeyRemovalBallotParamsValid(
                _affectedKey,
                _affectedKeyType,
                _miningKey
            );
        }
        if (_ballotType == uint256(BallotTypes.KeySwap)) {
            return _areKeySwapBallotParamsValid(
                _affectedKey,
                _affectedKeyType,
                _miningKey
            );
        }
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
        //require(_thresholds.length < 255);
        for (uint256 thresholdType = uint256(ThresholdTypes.Keys); thresholdType <= _thresholds.length; thresholdType++) {
            uint256 thresholdValue = _thresholds[thresholdType - uint256(ThresholdTypes.Keys)];
            if (!_setThreshold(thresholdValue, thresholdType)) {
                revert();
            }
        }
        _initDisable();
    }

    function metadataChangeConfirmationsLimit() public pure returns(uint256) {
        return 50;
    }

    function migrate(address _prevBallotsStorage) public onlyOwner {
        require(_prevBallotsStorage != address(0));
        require(!initDisabled());
        uint8 thresholdKeysType = uint8(ThresholdTypes.Keys);
        uint8 thresholdMetadataType = uint8(ThresholdTypes.MetadataChange);
        IBallotsStoragePrev prevBallotsStorage = IBallotsStoragePrev(_prevBallotsStorage);
        if (!_setThreshold(prevBallotsStorage.getBallotThreshold(thresholdKeysType), thresholdKeysType)) {
            revert();
        }
        if (!_setThreshold(prevBallotsStorage.getBallotThreshold(thresholdMetadataType), thresholdMetadataType)) {
            revert();
        }
        _initDisable();
    }

    function setThreshold(uint256 _newValue, uint256 _thresholdType)
        public
        onlyVotingToChangeThreshold
        returns(bool)
    {
        if (_newValue == getBallotThreshold(_thresholdType)) return false;
        if (!_setThreshold(_newValue, _thresholdType)) return false;
        emit ThresholdChanged(_thresholdType, _newValue);
        return true;
    }

    function getBallotThreshold(uint256 _ballotType) public view returns(uint256) {
        return uintStorage[keccak256(abi.encode(BALLOT_THRESHOLDS, _ballotType))];
    }

    function getVotingToChangeThreshold() public view returns(address) {
        return IProxyStorage(proxyStorage()).getVotingToChangeMinThreshold();
    }

    function getProxyThreshold() public view returns(uint256) {
        return _getTotalNumberOfValidators().div(2).add(1);
    }

    function getBallotLimitPerValidator() public view returns(uint256) {
        uint256 validatorsCount = _getTotalNumberOfValidators();
        if (validatorsCount == 0) {
            return getMaxLimitBallot();
        }
        uint256 limit = getMaxLimitBallot().div(validatorsCount);
        if (limit == 0) {
            limit = 1;
        }
        return limit;
    }
    
    function getMaxLimitBallot() public view returns(uint256) {
        return 200;
    }

    function _areKeyAddingBallotParamsValid(
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) internal view returns(bool) {
        IKeysManager keysManager = _getKeysManager();
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            return !keysManager.checkIfMiningExisted(_miningKey, _affectedKey);
        }
        if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
            require(_miningKey != keysManager.masterOfCeremony());
            require(keysManager.miningKeyByVoting(_affectedKey) == address(0));
            return _affectedKey != _miningKey && keysManager.isMiningActive(_miningKey);
        }
        if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
            require(keysManager.miningKeyByPayout(_affectedKey) == address(0));
            return _affectedKey != _miningKey && keysManager.isMiningActive(_miningKey);
        }
    }

    function _areKeyRemovalBallotParamsValid(
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) internal view returns(bool) {
        IKeysManager keysManager = _getKeysManager();
        require(keysManager.isMiningActive(_miningKey));
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            return true;
        }
        if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
            require(_affectedKey != _miningKey);
            address votingKey = keysManager.getVotingByMining(_miningKey);
            require(_affectedKey == votingKey);
            return keysManager.isVotingActive(votingKey);
        }
        if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
            require(_affectedKey != _miningKey);
            address payoutKey = keysManager.getPayoutByMining(_miningKey);
            require(_affectedKey == payoutKey);
            return keysManager.isPayoutActive(_miningKey);
        }
    }

    function _areKeySwapBallotParamsValid(
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) internal view returns(bool) {
        require(_affectedKey != _miningKey);
        IKeysManager keysManager = _getKeysManager();
        require(keysManager.isMiningActive(_miningKey));
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            return !keysManager.checkIfMiningExisted(_miningKey, _affectedKey);
        }
        if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
            address votingKey = keysManager.getVotingByMining(_miningKey);
            require(_affectedKey != votingKey);
            require(keysManager.miningKeyByVoting(_affectedKey) == address(0));
            return keysManager.isVotingActive(votingKey);
        }
        if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
            address payoutKey = keysManager.getPayoutByMining(_miningKey);
            require(_affectedKey != payoutKey);
            require(keysManager.miningKeyByPayout(_affectedKey) == address(0));
            return keysManager.isPayoutActive(_miningKey);
        }
    }

    function _initDisable() internal {
        boolStorage[INIT_DISABLED] = true;
    }

    function _getKeysManager() internal view returns(IKeysManager) {
        return IKeysManager(IProxyStorage(proxyStorage()).getKeysManager());
    }

    function _getTotalNumberOfValidators() internal view returns(uint256) {
        IProxyStorage proxy = IProxyStorage(proxyStorage());
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(proxy.getPoaConsensus());
        return poa.getCurrentValidatorsLengthWithoutMoC();
    }

    function _setThreshold(uint256 _newValue, uint256 _thresholdType) internal returns(bool) {
        if (_newValue == 0) return false;
        if (_thresholdType == uint256(ThresholdTypes.Invalid)) return false;
        if (_thresholdType > uint256(ThresholdTypes.MetadataChange)) return false;
        if (_thresholdType == uint256(ThresholdTypes.MetadataChange)) {
            if (_newValue > metadataChangeConfirmationsLimit()) {
                return false;
            }
        }
        uintStorage[
            keccak256(abi.encode(BALLOT_THRESHOLDS, _thresholdType))
        ] = _newValue;
        return true;
    }
}