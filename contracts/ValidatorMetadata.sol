pragma solidity ^0.4.18;

import "./SafeMath.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./eternal-storage/EternalStorage.sol";

contract ValidatorMetadata is EternalStorage {
    using SafeMath for uint256;

    event MetadataCreated(address indexed miningKey);
    event ChangeRequestInitiated(address indexed miningKey);
    event CancelledRequest(address indexed miningKey);
    event Confirmed(address indexed miningKey, address votingSender);
    event FinalizedChange(address indexed miningKey);
    event RequestForNewProxy(address newProxyAddress);
    event ChangeProxyStorage(address newProxyAddress);

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    modifier onlyFirstTime(address _votingKey) {
        address miningKey = getMiningByVotingKey(_votingKey);
        require(uintStorage[keccak256("validators", miningKey, "createdDate")] == 0);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == addressStorage[keccak256("owner")]);
        _;
    }

    function proxyStorage() public view returns (address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function pendingProxyStorage() public view returns (address) {
        return addressStorage[keccak256("pendingProxyStorage")];
    }

    function validators(address _miningKey) public view returns (
        bytes32 firstName,
        bytes32 lastName,
        bytes32 licenseId,
        string fullAddress,
        bytes32 state,
        bytes32 zipcode,
        uint256 expirationDate,
        uint256 createdDate,
        uint256 updatedDate,
        uint256 minThreshold
    ) {
        firstName = bytes32Storage[keccak256("validators", _miningKey, "firstName")];
        lastName = bytes32Storage[keccak256("validators", _miningKey, "lastName")];
        licenseId = bytes32Storage[keccak256("validators", _miningKey, "licenseId")];
        fullAddress = stringStorage[keccak256("validators", _miningKey, "fullAddress")];
        state = bytes32Storage[keccak256("validators", _miningKey, "state")];
        zipcode = bytes32Storage[keccak256("validators", _miningKey, "zipcode")];
        expirationDate = uintStorage[keccak256("validators", _miningKey, "expirationDate")];
        createdDate = uintStorage[keccak256("validators", _miningKey, "createdDate")];
        updatedDate = uintStorage[keccak256("validators", _miningKey, "updatedDate")];
        minThreshold = uintStorage[keccak256("validators", _miningKey, "minThreshold")];
    }

    function pendingChanges(address _miningKey) public view returns (
        bytes32 firstName,
        bytes32 lastName,
        bytes32 licenseId,
        string fullAddress,
        bytes32 state,
        bytes32 zipcode,
        uint256 expirationDate,
        uint256 createdDate,
        uint256 updatedDate,
        uint256 minThreshold
    ) {
        firstName = bytes32Storage[keccak256("pendingChanges", _miningKey, "firstName")];
        lastName = bytes32Storage[keccak256("pendingChanges", _miningKey, "lastName")];
        licenseId = bytes32Storage[keccak256("pendingChanges", _miningKey, "licenseId")];
        fullAddress = stringStorage[keccak256("pendingChanges", _miningKey, "fullAddress")];
        state = bytes32Storage[keccak256("pendingChanges", _miningKey, "state")];
        zipcode = bytes32Storage[keccak256("pendingChanges", _miningKey, "zipcode")];
        expirationDate = uintStorage[keccak256("pendingChanges", _miningKey, "expirationDate")];
        createdDate = uintStorage[keccak256("pendingChanges", _miningKey, "createdDate")];
        updatedDate = uintStorage[keccak256("pendingChanges", _miningKey, "updatedDate")];
        minThreshold = uintStorage[keccak256("pendingChanges", _miningKey, "minThreshold")];
    }

    function confirmations(address _miningKey) public view returns (
        uint256 count,
        address[] voters
    ) {
        return (
            uintStorage[keccak256("confirmations", _miningKey, "count")],
            addressArrayStorage[keccak256("confirmations", _miningKey, "voters")]
        );
    }

    function pendingProxyConfirmations(address _newProxyAddress) public view returns (
        uint256 count,
        address[] voters
    ) {
        bytes32 countHash = keccak256("pendingProxyConfirmations", _newProxyAddress, "count");
        bytes32 votersHash = keccak256("pendingProxyConfirmations", _newProxyAddress, "voters");

        return (
            uintStorage[countHash],
            addressArrayStorage[votersHash]
        );
    }

    function setProxyAddress(address _newProxyAddress) public onlyValidVotingKey(msg.sender) {
        bytes32 pendingProxyStorageHash =
            keccak256("pendingProxyStorage");

        require(addressStorage[pendingProxyStorageHash] == address(0));
        
        addressStorage[pendingProxyStorageHash] = _newProxyAddress;
        uintStorage[keccak256("pendingProxyConfirmations", _newProxyAddress, "count")] = 1;
        addressArrayStorage[keccak256("pendingProxyConfirmations", _newProxyAddress, "voters")].push(msg.sender);
        
        RequestForNewProxy(_newProxyAddress);
    }

    function confirmNewProxyAddress(address _newProxyAddress)
        public
        onlyValidVotingKey(msg.sender)
    {
        bytes32 proxyStorageHash = keccak256("proxyStorage");
        bytes32 pendingProxyStorageHash = keccak256("pendingProxyStorage");
        bytes32 countHash = keccak256("pendingProxyConfirmations", _newProxyAddress, "count");
        bytes32 votersHash = keccak256("pendingProxyConfirmations", _newProxyAddress, "voters");
        
        require(addressStorage[pendingProxyStorageHash] != address(0));
        require(!isAddressAlreadyVotedProxy(_newProxyAddress, msg.sender));

        uintStorage[countHash] = uintStorage[countHash].add(1);
        addressArrayStorage[votersHash].push(msg.sender);
        
        if (uintStorage[countHash] >= 3) {
            addressStorage[proxyStorageHash] = _newProxyAddress;
            addressStorage[pendingProxyStorageHash] = address(0);
            delete uintStorage[countHash];
            delete addressArrayStorage[votersHash];
            ChangeProxyStorage(_newProxyAddress);
        }
        
        Confirmed(_newProxyAddress, msg.sender);
    }

    function initMetadata(
        bytes32 _firstName,
        bytes32 _lastName,
        bytes32 _licenseId,
        string _fullAddress,
        bytes32 _state,
        bytes32 _zipcode,
        uint256 _expirationDate,
        uint256 _createdDate,
        uint256 _updatedDate,
        uint256 _minThreshold,
        address _miningKey
    )
        public
        onlyOwner
    {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isMiningActive(_miningKey));
        require(uintStorage[keccak256("validators", _miningKey, "createdDate")] == 0);
        require(_createdDate != 0);
        require(!boolStorage[keccak256("initMetadataDisabled")]);
        bytes32Storage[keccak256("validators", _miningKey, "firstName")] = _firstName;
        bytes32Storage[keccak256("validators", _miningKey, "lastName")] = _lastName;
        bytes32Storage[keccak256("validators", _miningKey, "licenseId")] = _licenseId;
        bytes32Storage[keccak256("validators", _miningKey, "state")] = _state;
        stringStorage[keccak256("validators", _miningKey, "fullAddress")] = _fullAddress;
        bytes32Storage[keccak256("validators", _miningKey, "zipcode")] = _zipcode;
        uintStorage[keccak256("validators", _miningKey, "expirationDate")] = _expirationDate;
        uintStorage[keccak256("validators", _miningKey, "createdDate")] = _createdDate;
        uintStorage[keccak256("validators", _miningKey, "updatedDate")] = _updatedDate;
        uintStorage[keccak256("validators", _miningKey, "minThreshold")] = _minThreshold;
    }

    function initMetadataDisable() public onlyOwner {
        boolStorage[keccak256("initMetadataDisabled")] = true;
    }

    function createMetadata(
        bytes32 _firstName,
        bytes32 _lastName,
        bytes32 _licenseId,
        string _fullAddress,
        bytes32 _state,
        bytes32 _zipcode,
        uint256 _expirationDate
    )
        public
        onlyValidVotingKey(msg.sender)
        onlyFirstTime(msg.sender)
    {
        address miningKey = getMiningByVotingKey(msg.sender);
        bytes32Storage[keccak256("validators", miningKey, "firstName")] = _firstName;
        bytes32Storage[keccak256("validators", miningKey, "lastName")] = _lastName;
        bytes32Storage[keccak256("validators", miningKey, "licenseId")] = _licenseId;
        bytes32Storage[keccak256("validators", miningKey, "state")] = _state;
        stringStorage[keccak256("validators", miningKey, "fullAddress")] = _fullAddress;
        bytes32Storage[keccak256("validators", miningKey, "zipcode")] = _zipcode;
        uintStorage[keccak256("validators", miningKey, "expirationDate")] = _expirationDate;
        uintStorage[keccak256("validators", miningKey, "createdDate")] = getTime();
        uintStorage[keccak256("validators", miningKey, "updatedDate")] = 0;
        uintStorage[keccak256("validators", miningKey, "minThreshold")] = getMinThreshold();
        MetadataCreated(miningKey);
    }

    function changeRequest(
        bytes32 _firstName,
        bytes32 _lastName,
        bytes32 _licenseId,
        string _fullAddress,
        bytes32 _state,
        bytes32 _zipcode,
        uint256 _expirationDate
    )
        public
        onlyValidVotingKey(msg.sender)
        returns(bool)
    {
        address miningKey = getMiningByVotingKey(msg.sender);
        return changeRequestForValidator(
            _firstName,
            _lastName,
            _licenseId,
            _fullAddress,
            _state,
            _zipcode,
            _expirationDate,
            miningKey
        );
    }

    function changeRequestForValidator(
        bytes32 _firstName,
        bytes32 _lastName,
        bytes32 _licenseId,
        string _fullAddress,
        bytes32 _state,
        bytes32 _zipcode,
        uint256 _expirationDate,
        address _miningKey
    )
        public
        onlyValidVotingKey(msg.sender)
        returns(bool) 
    {
        bytes32Storage[keccak256("pendingChanges", _miningKey, "firstName")] = _firstName;
        bytes32Storage[keccak256("pendingChanges", _miningKey, "lastName")] = _lastName;
        bytes32Storage[keccak256("pendingChanges", _miningKey, "licenseId")] = _licenseId;
        bytes32Storage[keccak256("pendingChanges", _miningKey, "state")] = _state;
        stringStorage[keccak256("pendingChanges", _miningKey, "fullAddress")] = _fullAddress;
        bytes32Storage[keccak256("pendingChanges", _miningKey, "zipcode")] = _zipcode;
        uintStorage[keccak256("pendingChanges", _miningKey, "expirationDate")] = _expirationDate;
        uintStorage[keccak256("pendingChanges", _miningKey, "createdDate")] =
            uintStorage[keccak256("validators", _miningKey, "createdDate")];
        uintStorage[keccak256("pendingChanges", _miningKey, "updatedDate")] = getTime();
        uintStorage[keccak256("pendingChanges", _miningKey, "minThreshold")] =
            uintStorage[keccak256("validators", _miningKey, "minThreshold")];
        
        delete uintStorage[keccak256("confirmations", _miningKey, "count")];
        delete addressArrayStorage[keccak256("confirmations", _miningKey, "voters")];
        
        ChangeRequestInitiated(_miningKey);
        return true;
    }

    function cancelPendingChange() public onlyValidVotingKey(msg.sender) returns(bool) {
        address miningKey = getMiningByVotingKey(msg.sender);
        _deletePendingChange(miningKey);
        CancelledRequest(miningKey);
        return true;
    }

    function isAddressAlreadyVoted(address _miningKey, address _voter) public view returns(bool) {
        bytes32 hash = keccak256("confirmations", _miningKey, "voters");
        uint256 length = addressArrayStorage[hash].length;
        for (uint256 i = 0; i < length; i++) {
            if (addressArrayStorage[hash][i] == _voter) {
                return true;   
            }
        }
        return false;
    }

    function isAddressAlreadyVotedProxy(address _newProxy, address _voter) public view returns(bool) {
        bytes32 hash = keccak256("pendingProxyConfirmations", _newProxy, "voters");
        uint256 length = addressArrayStorage[hash].length;
        for (uint256 i = 0; i < length; i++) {
            if (addressArrayStorage[hash][i] == _voter) {
                return true;   
            }
        }
        return false;
    }

    function confirmPendingChange(address _miningKey) public onlyValidVotingKey(msg.sender) {
        bytes32 votersHash = keccak256("confirmations", _miningKey, "voters");
        bytes32 countHash = keccak256("confirmations", _miningKey, "count");
        
        require(!isAddressAlreadyVoted(_miningKey, msg.sender));
        require(addressArrayStorage[votersHash].length <= 50); // no need for more confirmations

        address miningKey = getMiningByVotingKey(msg.sender);
        require(miningKey != _miningKey);

        addressArrayStorage[votersHash].push(msg.sender);
        uintStorage[countHash] = uintStorage[countHash].add(1);
        Confirmed(_miningKey, msg.sender);
    }

    function finalize(address _miningKey) public onlyValidVotingKey(msg.sender) {
        uint256 count =
            uintStorage[keccak256("confirmations", _miningKey, "count")];
        uint256 minThreshold =
            uintStorage[keccak256("pendingChanges", _miningKey, "minThreshold")];

        require(count >= minThreshold);
        require(onlyIfChangeExist(_miningKey));

        bytes32Storage[keccak256("validators", _miningKey, "firstName")] = 
            bytes32Storage[keccak256("pendingChanges", _miningKey, "firstName")];
        bytes32Storage[keccak256("validators", _miningKey, "lastName")] = 
            bytes32Storage[keccak256("pendingChanges", _miningKey, "lastName")];
        bytes32Storage[keccak256("validators", _miningKey, "licenseId")] = 
            bytes32Storage[keccak256("pendingChanges", _miningKey, "licenseId")];
        bytes32Storage[keccak256("validators", _miningKey, "state")] = 
            bytes32Storage[keccak256("pendingChanges", _miningKey, "state")];
        stringStorage[keccak256("validators", _miningKey, "fullAddress")] = 
            stringStorage[keccak256("pendingChanges", _miningKey, "fullAddress")];
        bytes32Storage[keccak256("validators", _miningKey, "zipcode")] = 
            bytes32Storage[keccak256("pendingChanges", _miningKey, "zipcode")];
        uintStorage[keccak256("validators", _miningKey, "expirationDate")] = 
            uintStorage[keccak256("pendingChanges", _miningKey, "expirationDate")];
        uintStorage[keccak256("validators", _miningKey, "createdDate")] = 
            uintStorage[keccak256("pendingChanges", _miningKey, "createdDate")];
        uintStorage[keccak256("validators", _miningKey, "updatedDate")] = 
            uintStorage[keccak256("pendingChanges", _miningKey, "updatedDate")];
        uintStorage[keccak256("validators", _miningKey, "minThreshold")] = 
            uintStorage[keccak256("pendingChanges", _miningKey, "minThreshold")];
        
        _deletePendingChange(_miningKey);
        FinalizedChange(_miningKey);
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function getMinThreshold() public view returns(uint256) {
        uint8 thresholdType = 2;
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotThreshold(thresholdType);
    }

    function getBallotsStorage() public view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function onlyIfChangeExist(address _miningKey) public view returns(bool) {
        return uintStorage[keccak256("pendingChanges", _miningKey, "createdDate")] > 0;
    }

    function _deletePendingChange(address _miningKey) private {
        delete bytes32Storage[keccak256("pendingChanges", _miningKey, "firstName")];
        delete bytes32Storage[keccak256("pendingChanges", _miningKey, "lastName")];
        delete bytes32Storage[keccak256("pendingChanges", _miningKey, "licenseId")];
        delete bytes32Storage[keccak256("pendingChanges", _miningKey, "state")];
        delete stringStorage[keccak256("pendingChanges", _miningKey, "fullAddress")];
        delete bytes32Storage[keccak256("pendingChanges", _miningKey, "zipcode")];
        delete uintStorage[keccak256("pendingChanges", _miningKey, "expirationDate")];
        delete uintStorage[keccak256("pendingChanges", _miningKey, "createdDate")];
        delete uintStorage[keccak256("pendingChanges", _miningKey, "updatedDate")];
        delete uintStorage[keccak256("pendingChanges", _miningKey, "minThreshold")];
    }

}