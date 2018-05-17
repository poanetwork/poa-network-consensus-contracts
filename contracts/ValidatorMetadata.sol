pragma solidity ^0.4.23;

import "./libs/SafeMath.sol";
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
        require(_getCreatedDate(false, miningKey) == 0);
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
        firstName = _getFirstName(false, _miningKey);
        lastName = _getLastName(false, _miningKey);
        licenseId = _getLicenseId(false, _miningKey);
        fullAddress = _getFullAddress(false, _miningKey);
        state = _getState(false, _miningKey);
        zipcode = _getZipcode(false, _miningKey);
        expirationDate = _getExpirationDate(false, _miningKey);
        createdDate = _getCreatedDate(false, _miningKey);
        updatedDate = _getUpdatedDate(false, _miningKey);
        minThreshold = _getMinThreshold(false, _miningKey);
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
        firstName = _getFirstName(true, _miningKey);
        lastName = _getLastName(true, _miningKey);
        licenseId = _getLicenseId(true, _miningKey);
        fullAddress = _getFullAddress(true, _miningKey);
        state = _getState(true, _miningKey);
        zipcode = _getZipcode(true, _miningKey);
        expirationDate = _getExpirationDate(true, _miningKey);
        createdDate = _getCreatedDate(true, _miningKey);
        updatedDate = _getUpdatedDate(true, _miningKey);
        minThreshold = _getMinThreshold(true, _miningKey);
    }

    function confirmations(address _miningKey) public view returns (
        uint256 count,
        address[] voters
    ) {
        voters = _getConfirmationsVoters(_miningKey);
        count = voters.length;
    }

    function pendingProxyConfirmations(address _newProxyAddress) public view returns (
        uint256 count,
        address[] voters
    ) {
        voters = _getPendingProxyConfirmationsVoters(_newProxyAddress);
        count = voters.length;
    }

    function setProxyAddress(address _newProxyAddress)
        public
        onlyValidVotingKey(msg.sender)
    {
        require(pendingProxyStorage() == address(0));
        _setPendingProxyStorage(_newProxyAddress);
        _pendingProxyConfirmationsVoterAdd(_newProxyAddress, msg.sender);
        emit RequestForNewProxy(_newProxyAddress);
    }

    function confirmNewProxyAddress(address _newProxyAddress)
        public
        onlyValidVotingKey(msg.sender)
    {
        require(pendingProxyStorage() != address(0));
        require(!isAddressAlreadyVotedProxy(_newProxyAddress, msg.sender));
        _pendingProxyConfirmationsVoterAdd(_newProxyAddress, msg.sender);
        uint256 count = _getPendingProxyConfirmationsVoters(_newProxyAddress).length;
        if (count >= 3) {
            _setProxyStorage(_newProxyAddress);
            _setPendingProxyStorage(address(0));
            delete addressArrayStorage[
                keccak256("pendingProxyConfirmations", _newProxyAddress, "voters")
            ];
            emit ChangeProxyStorage(_newProxyAddress);
        }
        
        emit Confirmed(_newProxyAddress, msg.sender);
    }

    function initMetadataDisabled() public view returns(bool) {
        return boolStorage[keccak256("initMetadataDisabled")];
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
        require(_getCreatedDate(false, _miningKey) == 0);
        require(_createdDate != 0);
        require(!initMetadataDisabled());
        _setFirstName(false, _miningKey, _firstName);
        _setLastName(false, _miningKey, _lastName);
        _setLicenseId(false, _miningKey, _licenseId);
        _setState(false, _miningKey, _state);
        _setFullAddress(false, _miningKey, _fullAddress);
        _setZipcode(false, _miningKey, _zipcode);
        _setExpirationDate(false, _miningKey, _expirationDate);
        _setCreatedDate(false, _miningKey, _createdDate);
        _setUpdatedDate(false, _miningKey, _updatedDate);
        _setMinThreshold(false, _miningKey, _minThreshold);
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
        _setFirstName(false, miningKey, _firstName);
        _setLastName(false, miningKey, _lastName);
        _setLicenseId(false, miningKey, _licenseId);
        _setState(false, miningKey, _state);
        _setFullAddress(false, miningKey, _fullAddress);
        _setZipcode(false, miningKey, _zipcode);
        _setExpirationDate(false, miningKey, _expirationDate);
        _setCreatedDate(false, miningKey, getTime());
        _setUpdatedDate(false, miningKey, 0);
        _setMinThreshold(false, miningKey, getMinThreshold());
        emit MetadataCreated(miningKey);
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
        _setFirstName(true, _miningKey, _firstName);
        _setLastName(true, _miningKey, _lastName);
        _setLicenseId(true, _miningKey, _licenseId);
        _setState(true, _miningKey, _state);
        _setFullAddress(true, _miningKey, _fullAddress);
        _setZipcode(true, _miningKey, _zipcode);
        _setExpirationDate(true, _miningKey, _expirationDate);
        _setCreatedDate(true, _miningKey, _getCreatedDate(false, _miningKey));
        _setUpdatedDate(true, _miningKey, getTime());
        _setMinThreshold(true, _miningKey, _getMinThreshold(false, _miningKey));
        delete addressArrayStorage[keccak256("confirmations", _miningKey, "voters")];
        emit ChangeRequestInitiated(_miningKey);
        return true;
    }

    function cancelPendingChange() public onlyValidVotingKey(msg.sender) returns(bool) {
        address miningKey = getMiningByVotingKey(msg.sender);
        _deletePendingChange(miningKey);
        emit CancelledRequest(miningKey);
        return true;
    }

    function isAddressAlreadyVoted(address _miningKey, address _voter)
        public
        view
        returns(bool)
    {
        uint256 count;
        address[] memory voters;
        (count, voters) = confirmations(_miningKey);
        for (uint256 i = 0; i < count; i++) {
            if (voters[i] == _voter) {
                return true;   
            }
        }
        return false;
    }

    function isAddressAlreadyVotedProxy(address _newProxy, address _voter)
        public
        view
        returns(bool)
    {
        uint256 count;
        address[] memory voters;
        (count, voters) = pendingProxyConfirmations(_newProxy);
        for (uint256 i = 0; i < count; i++) {
            if (voters[i] == _voter) {
                return true;   
            }
        }
        return false;
    }

    function confirmPendingChange(address _miningKey)
        public
        onlyValidVotingKey(msg.sender)
    {
        require(!isAddressAlreadyVoted(_miningKey, msg.sender));
        uint256 count = _getConfirmationsVoters(_miningKey).length;
        require(count <= 50); // no need for more confirmations
        address miningKey = getMiningByVotingKey(msg.sender);
        require(miningKey != _miningKey);
        _confirmationsVoterAdd(_miningKey, msg.sender);
        emit Confirmed(_miningKey, msg.sender);
    }

    function finalize(address _miningKey) public onlyValidVotingKey(msg.sender) {
        require(onlyIfChangeExist(_miningKey));
        uint256 count = _getConfirmationsVoters(_miningKey).length;
        uint256 minThreshold = _getMinThreshold(true, _miningKey);
        require(count >= minThreshold);
        _setFirstName(false, _miningKey, _getFirstName(true, _miningKey));
        _setLastName(false, _miningKey, _getLastName(true, _miningKey));
        _setLicenseId(false, _miningKey, _getLicenseId(true, _miningKey));
        _setState(false, _miningKey, _getState(true, _miningKey));
        _setFullAddress(false, _miningKey, _getFullAddress(true, _miningKey));
        _setZipcode(false, _miningKey, _getZipcode(true, _miningKey));
        _setExpirationDate(false, _miningKey, _getExpirationDate(true, _miningKey));
        _setCreatedDate(false, _miningKey, _getCreatedDate(true, _miningKey));
        _setUpdatedDate(false, _miningKey, _getUpdatedDate(true, _miningKey));
        _setMinThreshold(false, _miningKey, _getMinThreshold(true, _miningKey));
        _deletePendingChange(_miningKey);
        emit FinalizedChange(_miningKey);
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function getMinThreshold() public view returns(uint256) {
        uint8 metadataChangeThresholdType = 2;
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotThreshold(metadataChangeThresholdType);
    }

    function getBallotsStorage() public view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function onlyIfChangeExist(address _miningKey) public view returns(bool) {
        return _getCreatedDate(true, _miningKey) > 0;
    }

    function _storeName(bool _pending) private pure returns(string) {
        return _pending ? "pendingChanges" : "validators";
    }

    function _getFirstName(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(_storeName(_pending), _miningKey, "firstName")];
    }

    function _getLastName(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(_storeName(_pending), _miningKey, "lastName")];
    }

    function _getLicenseId(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(_storeName(_pending), _miningKey, "licenseId")];
    }

    function _getFullAddress(bool _pending, address _miningKey)
        private
        view
        returns(string)
    {
        return stringStorage[keccak256(_storeName(_pending), _miningKey, "fullAddress")];
    }

    function _getState(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(_storeName(_pending), _miningKey, "state")];
    }

    function _getZipcode(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(_storeName(_pending), _miningKey, "zipcode")];
    }

    function _getExpirationDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(_storeName(_pending), _miningKey, "expirationDate")];
    }

    function _getCreatedDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(_storeName(_pending), _miningKey, "createdDate")];
    }

    function _getUpdatedDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(_storeName(_pending), _miningKey, "updatedDate")];
    }

    function _getMinThreshold(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(_storeName(_pending), _miningKey, "minThreshold")];
    }

    function _getConfirmationsVoters(address _miningKey)
        private
        view
        returns(address[] voters)
    {
        voters = addressArrayStorage[keccak256("confirmations", _miningKey, "voters")];
    }

    function _getPendingProxyConfirmationsVoters(address _newProxyAddress)
        private
        view
        returns(address[] voters)
    {
        voters = addressArrayStorage[
            keccak256("pendingProxyConfirmations", _newProxyAddress, "voters")
        ];
    }

    function _deletePendingChange(address _miningKey) private {
        string memory _store = _storeName(true);
        delete bytes32Storage[keccak256(_store, _miningKey, "firstName")];
        delete bytes32Storage[keccak256(_store, _miningKey, "lastName")];
        delete bytes32Storage[keccak256(_store, _miningKey, "licenseId")];
        delete bytes32Storage[keccak256(_store, _miningKey, "state")];
        delete stringStorage[keccak256(_store, _miningKey, "fullAddress")];
        delete bytes32Storage[keccak256(_store, _miningKey, "zipcode")];
        delete uintStorage[keccak256(_store, _miningKey, "expirationDate")];
        delete uintStorage[keccak256(_store, _miningKey, "createdDate")];
        delete uintStorage[keccak256(_store, _miningKey, "updatedDate")];
        delete uintStorage[keccak256(_store, _miningKey, "minThreshold")];
    }

    function _setFirstName(bool _pending, address _miningKey, bytes32 _firstName) private {
        bytes32Storage[keccak256(
            _storeName(_pending),
            _miningKey,
            "firstName"
        )] = _firstName;
    }

    function _setLastName(bool _pending, address _miningKey, bytes32 _lastName) private {
        bytes32Storage[keccak256(
            _storeName(_pending),
            _miningKey,
            "lastName"
        )] = _lastName;
    }

    function _setLicenseId(bool _pending, address _miningKey, bytes32 _licenseId) private {
        bytes32Storage[keccak256(
            _storeName(_pending),
            _miningKey,
            "licenseId"
        )] = _licenseId;
    }

    function _setState(bool _pending, address _miningKey, bytes32 _state) private {
        bytes32Storage[keccak256(
            _storeName(_pending),
            _miningKey,
            "state"
        )] = _state;
    }

    function _setFullAddress(
        bool _pending,
        address _miningKey,
        string _fullAddress
    ) private {
        stringStorage[keccak256(
            _storeName(_pending),
            _miningKey,
            "fullAddress"
        )] = _fullAddress;
    }

    function _setZipcode(bool _pending, address _miningKey, bytes32 _zipcode) private {
        bytes32Storage[keccak256(
            _storeName(_pending),
            _miningKey,
            "zipcode"
        )] = _zipcode;
    }

    function _setExpirationDate(
        bool _pending,
        address _miningKey,
        uint256 _expirationDate
    ) private {
        uintStorage[keccak256(
            _storeName(_pending),
            _miningKey,
            "expirationDate"
        )] = _expirationDate;
    }

    function _setCreatedDate(
        bool _pending,
        address _miningKey,
        uint256 _createdDate
    ) private {
        uintStorage[keccak256(
            _storeName(_pending),
            _miningKey,
            "createdDate"
        )] = _createdDate;
    }

    function _setUpdatedDate(
        bool _pending,
        address _miningKey,
        uint256 _updatedDate
    ) private {
        uintStorage[keccak256(
            _storeName(_pending),
            _miningKey,
            "updatedDate"
        )] = _updatedDate;
    }

    function _setMinThreshold(
        bool _pending,
        address _miningKey,
        uint256 _minThreshold
    ) private {
        uintStorage[keccak256(
            _storeName(_pending),
            _miningKey,
            "minThreshold"
        )] = _minThreshold;
    }

    function _setProxyStorage(address _proxyStorage) private {
        addressStorage[keccak256("proxyStorage")] = _proxyStorage;
    }

    function _setPendingProxyStorage(address _proxyStorage) private {
        addressStorage[keccak256("pendingProxyStorage")] = _proxyStorage;
    }

    function _confirmationsVoterAdd(address _miningKey, address _voter) private {
        addressArrayStorage[
            keccak256("confirmations", _miningKey, "voters")
        ].push(_voter);
    }

    function _pendingProxyConfirmationsVoterAdd(
        address _newProxyAddress,
        address _voter
    ) private {
        addressArrayStorage[
            keccak256("pendingProxyConfirmations", _newProxyAddress, "voters")
        ].push(_voter);
    }

}