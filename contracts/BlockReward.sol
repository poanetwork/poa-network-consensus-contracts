pragma solidity ^0.4.23;

import "./interfaces/IBlockReward.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";


contract BlockReward is IBlockReward {
    address internal SYSTEM_ADDRESS = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;
    
    IProxyStorage public proxyStorage;
    address public emissionFunds;
    uint256 public blockRewardAmount;
    uint256 public emissionFundsAmount;

    event Rewarded(address[] receivers, uint256[] rewards);

    modifier onlySystem {
        require(msg.sender == SYSTEM_ADDRESS);
        _;
    }

    constructor(
        address _proxyStorage,
        address _emissionFunds,
        uint256 _blockRewardAmount,
        uint256 _emissionFundsAmount
    ) public {
        require(_proxyStorage != address(0));
        require(_blockRewardAmount != 0);
        proxyStorage = IProxyStorage(_proxyStorage);
        emissionFunds = _emissionFunds;
        blockRewardAmount = _blockRewardAmount;
        emissionFundsAmount = _emissionFundsAmount;
    }

    function reward(address[] benefactors, uint16[] kind)
        external
        onlySystem
        returns (address[], uint256[])
    {
        require(benefactors.length == kind.length);
        require(benefactors.length == 1);
        require(kind[0] == 0);

        address miningKey = benefactors[0];
        
        require(_isMiningActive(miningKey));

        address payoutKey = _getPayoutByMining(miningKey);
        uint256 receiversLength = 2;

        if (emissionFunds == address(0) || emissionFundsAmount == 0) {
            receiversLength = 1;
        }

        address[] memory receivers = new address[](receiversLength);
        uint256[] memory rewards = new uint256[](receiversLength);

        receivers[0] = (payoutKey != address(0)) ? payoutKey : miningKey;
        rewards[0] = blockRewardAmount;

        if (receiversLength == 2) {
            receivers[1] = emissionFunds;
            rewards[1] = emissionFundsAmount;
        }

        emit Rewarded(receivers, rewards);
    
        return (receivers, rewards);
    }

    function _getPayoutByMining(address _miningKey)
        private
        view
        returns (address)
    {
        IKeysManager keysManager = IKeysManager(proxyStorage.getKeysManager());
        return keysManager.getPayoutByMining(_miningKey);
    }

    function _isMiningActive(address _miningKey)
        private
        view
        returns (bool)
    {
        IKeysManager keysManager = IKeysManager(proxyStorage.getKeysManager());
        return keysManager.isMiningActive(_miningKey);
    }
}
