pragma solidity ^0.4.24;

import "./interfaces/IRewardByTime.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";
import "./libs/SafeMath.sol";


contract RewardByTime is EternalStorage, IRewardByTime {
    using SafeMath for uint256;

    bytes32 internal constant LAST_TIME = keccak256("rbtLastTime");
    bytes32 internal constant KEY_INDEX = keccak256("rbtKeyIndex");
    bytes32 internal constant PAYOUT_KEYS = keccak256("rbtPayoutKeys");

    // solhint-disable const-name-snakecase
    // These values must be changed before deploy
    uint256 public constant blockRewardAmount = 1 ether;
    uint256 public constant emissionFundsAmount = 1 ether;
    address public constant emissionFunds = 0x0000000000000000000000000000000000000000;
    uint256 public constant threshold = 5 seconds;
    // solhint-enable const-name-snakecase

    event Rewarded(address[] receivers, uint256[] rewards);

    modifier onlySystem {
        require(msg.sender == 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE);
        _;
    }

    function reward()
        external
        onlySystem
        returns (address[], uint256[])
    {
        uint256 currentTime = getTime();
        address[] memory receivers;
        uint256[] memory rewards;
        uint256 keysNumberToReward;
        uint256 n;
        
        if (getPayoutKeys().length == 0) { // the first call
            _setLastTime(currentTime.sub(threshold));
            _refreshPayoutKeys();
        }

        keysNumberToReward = currentTime.sub(lastTime()).div(threshold);

        if (keysNumberToReward == 0 || getPayoutKeys().length == 0) {
            receivers = new address[](0);
            rewards = new uint256[](0);
            return (receivers, rewards);
        }

        receivers = new address[](keysNumberToReward.add(1));
        rewards = new uint256[](receivers.length);

        for (n = 0; n < keysNumberToReward; n++) {
            uint256 index = keyIndex();
            receivers[n] = payoutKeys(index);
            rewards[n] = blockRewardAmount;
            _setLastTime(lastTime().add(threshold));
            _setKeyIndex(++index);

            if (index >= getPayoutKeys().length) {
                _refreshPayoutKeys();
            }
        }

        receivers[n] = emissionFunds;
        rewards[n] = emissionFundsAmount.mul(keysNumberToReward);

        emit Rewarded(receivers, rewards);

        return (receivers, rewards);
    }

    function getPayoutKeys() public view returns(address[]) {
        return addressArrayStorage[PAYOUT_KEYS];
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function keyIndex() public view returns(uint256) {
        return uintStorage[KEY_INDEX];
    }

    function lastTime() public view returns(uint256) {
        return uintStorage[LAST_TIME];
    }

    function payoutKeys(uint256 _index) public view returns(address) {
        return addressArrayStorage[PAYOUT_KEYS][_index];
    }

    function _getPayoutByMining(address _miningKey)
        private
        view
        returns (address)
    {
        IKeysManager keysManager = IKeysManager(
            IProxyStorage(proxyStorage()).getKeysManager()
        );
        return keysManager.getPayoutByMining(_miningKey);
    }

    function _refreshPayoutKeys() private {
        IPoaNetworkConsensus poa = IPoaNetworkConsensus(
            IProxyStorage(proxyStorage()).getPoaConsensus()
        );
        address[] memory validators = poa.getValidators();

        delete addressArrayStorage[PAYOUT_KEYS];
        for (uint256 i = 0; i < validators.length; i++) {
            address miningKey = validators[i];
            address payoutKey = _getPayoutByMining(miningKey);
            addressArrayStorage[PAYOUT_KEYS].push(
                (payoutKey != address(0)) ? payoutKey : miningKey
            );
        }

        _setKeyIndex(0);
    }

    function _setKeyIndex(uint256 _index) private {
        uintStorage[KEY_INDEX] = _index;
    }

    function _setLastTime(uint256 _time) private {
        uintStorage[LAST_TIME] = _time;
    }
}
