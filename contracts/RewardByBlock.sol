pragma solidity ^0.4.24;

import "./interfaces/IRewardByBlock.sol";
import "./interfaces/IKeysManager.sol";
import "./interfaces/IProxyStorage.sol";
import "./eternal-storage/EternalStorage.sol";
import "./libs/SafeMath.sol";


contract RewardByBlock is EternalStorage, IRewardByBlock {
    using SafeMath for uint256;

    bytes32 internal constant BRIDGES = keccak256("bridges");
    bytes32 internal constant EXTRA_RECEIVERS = keccak256("extraReceivers");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");
    bytes32 internal constant MINTED_TOTALLY = keccak256("mintedTotally");

    bytes32 internal constant BRIDGES_AMOUNTS = "bridgesAmounts";
    bytes32 internal constant EXTRA_RECEIVERS_AMOUNTS = "extraReceiversAmounts";
    bytes32 internal constant MINTED_FOR_ACCOUNT = "mintedForAccount";
    bytes32 internal constant MINTED_FOR_ACCOUNT_IN_BLOCK = "mintedForAccountInBlock";
    bytes32 internal constant MINTED_IN_BLOCK = "mintedInBlock";
    bytes32 internal constant MINTED_TOTALLY_BY_BRIDGE = "mintedTotallyByBridge";

    // solhint-disable const-name-snakecase
    // These values must be changed before deploy
    uint256 public constant blockRewardAmount = 1 ether; 
    uint256 public constant emissionFundsAmount = 1 ether;
    address public constant emissionFunds = 0x0000000000000000000000000000000000000000;
    // solhint-enable const-name-snakecase

    event AddedReceiver(uint256 amount, address indexed receiver, address indexed bridge);
    event Rewarded(address[] receivers, uint256[] rewards);

    modifier onlyBridgeContract {
        require(isBridgeContract(msg.sender));
        _;
    }

    modifier onlySystem {
        require(msg.sender == 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE);
        _;
    }

    function addExtraReceiver(uint256 _amount, address _receiver)
        external
        onlyBridgeContract
    {
        require(_amount != 0);
        require(_receiver != address(0));
        uint256 oldAmount = extraReceiversAmounts(_receiver);
        uint256 oldBridgeAmount = bridgesAmounts(msg.sender);
        if (oldAmount == 0) {
            _addExtraReceiver(_receiver);
        }
        if (oldBridgeAmount == 0) {
            _addBridge(msg.sender);
        }
        _setExtraReceiverAmount(oldAmount.add(_amount), _receiver);
        _setBridgeAmount(oldBridgeAmount.add(_amount), msg.sender);
        emit AddedReceiver(_amount, _receiver, msg.sender);
    }

    function isBridgeContract(address _addr) public pure returns(bool) {
        // These values must be changed before deploy
        if (_addr == 0x0000000000000000000000000000000000000000) return true;
        if (_addr == 0x0000000000000000000000000000000000000000) return true;
        if (_addr == 0x0000000000000000000000000000000000000000) return true;
        return false;
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

        uint256 length = extraReceiversLength();

        address[] memory receivers = new address[](length.add(2));
        uint256[] memory rewards = new uint256[](receivers.length);

        receivers[0] = _getPayoutByMining(miningKey);
        rewards[0] = blockRewardAmount;
        receivers[1] = emissionFunds;
        rewards[1] = emissionFundsAmount;

        uint256 i;
        
        for (i = 0; i < length; i++) {
            address extraAddress = extraReceivers(i);
            uint256 extraAmount = extraReceiversAmounts(extraAddress);
            _setExtraReceiverAmount(0, extraAddress);
            receivers[i.add(2)] = extraAddress;
            rewards[i.add(2)] = extraAmount;
        }

        for (i = 0; i < receivers.length; i++) {
            _setMinted(rewards[i], receivers[i]);
        }

        length = bridgesLength();
        for (i = 0; i < length; i++) {
            address bridgeAddress = bridges(i);
            uint256 bridgeAmount = bridgesAmounts(bridgeAddress);
            _setBridgeAmount(0, bridgeAddress);
            _addMintedByBridge(bridgeAmount, bridgeAddress);
        }

        _clearExtraReceivers();
        _clearBridges();

        emit Rewarded(receivers, rewards);
    
        return (receivers, rewards);
    }

    function bridges(uint256 _index) public view returns(address) {
        return addressArrayStorage[BRIDGES][_index];
    }

    function bridgesAmounts(address _bridge) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(BRIDGES_AMOUNTS, _bridge))
        ];
    }

    function bridgesLength() public view returns(uint256) {
        return addressArrayStorage[BRIDGES].length;
    }

    function extraReceivers(uint256 _index) public view returns(address) {
        return addressArrayStorage[EXTRA_RECEIVERS][_index];
    }

    function extraReceiversAmounts(address _receiver) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(EXTRA_RECEIVERS_AMOUNTS, _receiver))
        ];
    }

    function extraReceiversLength() public view returns(uint256) {
        return addressArrayStorage[EXTRA_RECEIVERS].length;
    }

    function mintedForAccount(address _account)
        public
        view
        returns(uint256)
    {
        return uintStorage[
            keccak256(abi.encode(MINTED_FOR_ACCOUNT, _account))
        ];
    }

    function mintedForAccountInBlock(address _account, uint256 _blockNumber)
        public
        view
        returns(uint256)
    {
        return uintStorage[
            keccak256(abi.encode(MINTED_FOR_ACCOUNT_IN_BLOCK, _account, _blockNumber))
        ];
    }

    function mintedInBlock(uint256 _blockNumber) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(MINTED_IN_BLOCK, _blockNumber))
        ];
    }

    function mintedTotally() public view returns(uint256) {
        return uintStorage[MINTED_TOTALLY];
    }

    function mintedTotallyByBridge(address _bridge) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge))
        ];
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[PROXY_STORAGE];
    }

    function _addBridge(address _bridge) private {
        addressArrayStorage[BRIDGES].push(_bridge);
    }

    function _addExtraReceiver(address _receiver) private {
        addressArrayStorage[EXTRA_RECEIVERS].push(_receiver);
    }

    function _addMintedByBridge(uint256 _amount, address _bridge) private {
        bytes32 hash = keccak256(abi.encode(MINTED_TOTALLY_BY_BRIDGE, _bridge));
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }

    function _clearBridges() private {
        addressArrayStorage[BRIDGES].length = 0;
    }

    function _clearExtraReceivers() private {
        addressArrayStorage[EXTRA_RECEIVERS].length = 0;
    }

    function _getPayoutByMining(address _miningKey)
        private
        view
        returns (address)
    {
        IKeysManager keysManager = IKeysManager(
            IProxyStorage(proxyStorage()).getKeysManager()
        );
        address payoutKey = keysManager.getPayoutByMining(_miningKey);
        return (payoutKey != address(0)) ? payoutKey : _miningKey;
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

    function _setBridgeAmount(uint256 _amount, address _bridge) private {
        uintStorage[
            keccak256(abi.encode(BRIDGES_AMOUNTS, _bridge))
        ] = _amount;
    }

    function _setExtraReceiverAmount(uint256 _amount, address _receiver) private {
        uintStorage[
            keccak256(abi.encode(EXTRA_RECEIVERS_AMOUNTS, _receiver))
        ] = _amount;
    }

    function _setMinted(uint256 _amount, address _account) private {
        bytes32 hash;

        hash = keccak256(abi.encode(MINTED_FOR_ACCOUNT_IN_BLOCK, _account, block.number));
        uintStorage[hash] = _amount;

        hash = keccak256(abi.encode(MINTED_FOR_ACCOUNT, _account));
        uintStorage[hash] = uintStorage[hash].add(_amount);

        hash = keccak256(abi.encode(MINTED_IN_BLOCK, block.number));
        uintStorage[hash] = uintStorage[hash].add(_amount);

        hash = MINTED_TOTALLY;
        uintStorage[hash] = uintStorage[hash].add(_amount);
    }
}
