pragma solidity ^0.4.24;

import "./interfaces/IRewardByBlock.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IPoaNetworkConsensus.sol";
import "./eternal-storage/EternalStorage.sol";
import "./libs/SafeMath.sol";


contract RewardByBlock is EternalStorage, IRewardByBlock {
    using SafeMath for uint256;

    // solhint-disable const-name-snakecase
    // These values must be changed before deploy
    uint256 public constant blockRewardAmount = 1 ether; 
    uint256 public constant emissionFundsAmount = 1 ether;
    address public constant emissionFunds = 0x0000000000000000000000000000000000000000;
    // solhint-enable const-name-snakecase

    event Rewarded(address[] receivers, uint256[] rewards);

    modifier onlySystem {
        require(msg.sender == 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE);
        _;
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

        address[] memory receivers = new address[](2);
        uint256[] memory rewards = new uint256[](2);

        receivers[0] = (payoutKey != address(0)) ? payoutKey : miningKey;
        rewards[0] = blockRewardAmount;
        receivers[1] = emissionFunds;
        rewards[1] = emissionFundsAmount;

        emit Rewarded(receivers, rewards);
    
        return (receivers, rewards);
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
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

    function _isMiningActive(address _miningKey)
        private
        view
        returns (bool)
    {
        IKeysManager keysManager = IKeysManager(
            IProxyStorage(proxyStorage()).getKeysManager()
        );
        return keysManager.isMiningActive(_miningKey);
    }
}
