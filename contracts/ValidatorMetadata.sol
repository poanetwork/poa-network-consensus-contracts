pragma solidity ^0.4.24;

import "./libs/SafeMath.sol";
import "./interfaces/IBallotsStorage.sol";
import "./interfaces/IProxyStorage.sol";
import "./interfaces/IKeysManager.sol";
import "./eternal-storage/EternalStorage.sol";


contract ValidatorMetadata is EternalStorage {
    using SafeMath for uint256;

    bytes32 internal constant INIT_METADATA_DISABLED = keccak256("initMetadataDisabled");
    bytes32 internal constant OWNER = keccak256("owner");
    bytes32 internal constant PENDING_PROXY_STORAGE = keccak256("pendingProxyStorage");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");

    string internal constant CONFIRMATIONS = "confirmations";
    string internal constant CREATED_DATE = "createdDate";
    string internal constant EXPIRATION_DATE = "expirationDate";
    string internal constant FIRST_NAME = "firstName";
    string internal constant FULL_ADDRESS = "fullAddress";
    string internal constant LAST_NAME = "lastName";
    string internal constant LICENSE_ID = "licenseId";
    string internal constant MIN_THRESHOLD = "minThreshold";
    string internal constant PENDING_PROXY_CONFIRMATIONS = "pendingProxyConfirmations";
    string internal constant STATE = "state";
    string internal constant UPDATED_DATE = "updatedDate";
    string internal constant VOTERS = "voters";
    string internal constant ZIP_CODE = "zipcode";

    uint256 public constant MAX_PENDING_CHANGE_CONFIRMATIONS = 50;

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
        require(msg.sender == addressStorage[OWNER]);
        _;
    }

    function proxyStorage() public view returns (address) {
        return addressStorage[PROXY_STORAGE];
    }

    function pendingProxyStorage() public view returns (address) {
        return addressStorage[PENDING_PROXY_STORAGE];
    }

    function getValidatorName(address _miningKey) public view returns (
        bytes32 firstName,
        bytes32 lastName
    ) {
        firstName = _getFirstName(false, _miningKey);
        lastName = _getLastName(false, _miningKey);
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
        return _validators(false, _miningKey);
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
        return _validators(true, _miningKey);
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
            delete addressArrayStorage[keccak256(abi.encodePacked(
                PENDING_PROXY_CONFIRMATIONS, _newProxyAddress, VOTERS
            ))];
            emit ChangeProxyStorage(_newProxyAddress);
        }
        
        emit Confirmed(_newProxyAddress, msg.sender);
    }

    function initMetadataDisabled() public view returns(bool) {
        return boolStorage[INIT_METADATA_DISABLED];
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
    ) public onlyOwner {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isMiningActive(_miningKey));
        require(_getCreatedDate(false, _miningKey) == 0);
        require(_createdDate != 0);
        require(!initMetadataDisabled());
        _setMetadata(
            false,
            _miningKey,
            _firstName,
            _lastName,
            _licenseId,
            _fullAddress,
            _state,
            _zipcode,
            _expirationDate,
            _createdDate,
            _updatedDate,
            _minThreshold
        );
    }

    function initMetadataDisable() public onlyOwner {
        boolStorage[INIT_METADATA_DISABLED] = true;
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
        _setMetadata(
            false,
            miningKey,
            _firstName,
            _lastName,
            _licenseId,
            _fullAddress,
            _state,
            _zipcode,
            _expirationDate,
            getTime(),
            0,
            getMinThreshold()
        );
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
        _setMetadata(
            true,
            _miningKey,
            _firstName,
            _lastName,
            _licenseId,
            _fullAddress,
            _state,
            _zipcode,
            _expirationDate,
            _getCreatedDate(false, _miningKey),
            getTime(),
            getMinThreshold()
        );
        _setMinThreshold(true, _miningKey, _getMinThreshold(false, _miningKey));
        delete addressArrayStorage[keccak256(abi.encodePacked(
            CONFIRMATIONS, _miningKey, VOTERS
        ))];
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
        require(count <= MAX_PENDING_CHANGE_CONFIRMATIONS); // no need for more confirmations
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
        return bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, FIRST_NAME
        ))];
    }

    function _getLastName(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, LAST_NAME
        ))];
    }

    function _getLicenseId(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, LICENSE_ID
        ))];
    }

    function _getFullAddress(bool _pending, address _miningKey)
        private
        view
        returns(string)
    {
        return stringStorage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, FULL_ADDRESS
        ))];
    }

    function _getState(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, STATE
        ))];
    }

    function _getZipcode(bool _pending, address _miningKey)
        private
        view
        returns(bytes32)
    {
        return bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, ZIP_CODE
        ))];
    }

    function _getExpirationDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, EXPIRATION_DATE
        ))];
    }

    function _getCreatedDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, CREATED_DATE
        ))];
    }

    function _getUpdatedDate(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, UPDATED_DATE
        ))];
    }

    function _getMinThreshold(bool _pending, address _miningKey)
        private
        view
        returns(uint256)
    {
        return uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending), _miningKey, MIN_THRESHOLD
        ))];
    }

    function _getConfirmationsVoters(address _miningKey)
        private
        view
        returns(address[] voters)
    {
        voters = addressArrayStorage[keccak256(abi.encodePacked(
            CONFIRMATIONS, _miningKey, VOTERS
        ))];
    }

    function _getPendingProxyConfirmationsVoters(address _newProxyAddress)
        private
        view
        returns(address[] voters)
    {
        voters = addressArrayStorage[keccak256(abi.encodePacked(
            PENDING_PROXY_CONFIRMATIONS, _newProxyAddress, VOTERS
        ))];
    }

    function _deletePendingChange(address _miningKey) private {
        string memory _store = _storeName(true);
        delete bytes32Storage[keccak256(abi.encodePacked(_store, _miningKey, FIRST_NAME))];
        delete bytes32Storage[keccak256(abi.encodePacked(_store, _miningKey, LAST_NAME))];
        delete bytes32Storage[keccak256(abi.encodePacked(_store, _miningKey, LICENSE_ID))];
        delete bytes32Storage[keccak256(abi.encodePacked(_store, _miningKey, STATE))];
        delete stringStorage[keccak256(abi.encodePacked(_store, _miningKey, FULL_ADDRESS))];
        delete bytes32Storage[keccak256(abi.encodePacked(_store, _miningKey, ZIP_CODE))];
        delete uintStorage[keccak256(abi.encodePacked(_store, _miningKey, EXPIRATION_DATE))];
        delete uintStorage[keccak256(abi.encodePacked(_store, _miningKey, CREATED_DATE))];
        delete uintStorage[keccak256(abi.encodePacked(_store, _miningKey, UPDATED_DATE))];
        delete uintStorage[keccak256(abi.encodePacked(_store, _miningKey, MIN_THRESHOLD))];
    }

    function _setFirstName(bool _pending, address _miningKey, bytes32 _firstName) private {
        bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            FIRST_NAME
        ))] = _firstName;
    }

    function _setLastName(bool _pending, address _miningKey, bytes32 _lastName) private {
        bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            LAST_NAME
        ))] = _lastName;
    }

    function _setLicenseId(bool _pending, address _miningKey, bytes32 _licenseId) private {
        bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            LICENSE_ID
        ))] = _licenseId;
    }

    function _setState(bool _pending, address _miningKey, bytes32 _state) private {
        bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            STATE
        ))] = _state;
    }

    function _setFullAddress(
        bool _pending,
        address _miningKey,
        string _fullAddress
    ) private {
        stringStorage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            FULL_ADDRESS
        ))] = _fullAddress;
    }

    function _setZipcode(bool _pending, address _miningKey, bytes32 _zipcode) private {
        bytes32Storage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            ZIP_CODE
        ))] = _zipcode;
    }

    function _setExpirationDate(
        bool _pending,
        address _miningKey,
        uint256 _expirationDate
    ) private {
        uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            EXPIRATION_DATE
        ))] = _expirationDate;
    }

    function _setCreatedDate(
        bool _pending,
        address _miningKey,
        uint256 _createdDate
    ) private {
        uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            CREATED_DATE
        ))] = _createdDate;
    }

    function _setUpdatedDate(
        bool _pending,
        address _miningKey,
        uint256 _updatedDate
    ) private {
        uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            UPDATED_DATE
        ))] = _updatedDate;
    }

    function _setMetadata(
        bool _pending,
        address _miningKey,
        bytes32 _firstName,
        bytes32 _lastName,
        bytes32 _licenseId,
        string _fullAddress,
        bytes32 _state,
        bytes32 _zipcode,
        uint256 _expirationDate,
        uint256 _createdDate,
        uint256 _updatedDate,
        uint256 _minThreshold
    ) private {
        _setFirstName(_pending, _miningKey, _firstName);
        _setLastName(_pending, _miningKey, _lastName);
        _setLicenseId(_pending, _miningKey, _licenseId);
        _setState(_pending, _miningKey, _state);
        _setFullAddress(_pending, _miningKey, _fullAddress);
        _setZipcode(_pending, _miningKey, _zipcode);
        _setExpirationDate(_pending, _miningKey, _expirationDate);
        _setCreatedDate(_pending, _miningKey, _createdDate);
        _setUpdatedDate(_pending, _miningKey, _updatedDate);
        _setMinThreshold(_pending, _miningKey, _minThreshold);
    }

    function _setMinThreshold(
        bool _pending,
        address _miningKey,
        uint256 _minThreshold
    ) private {
        uintStorage[keccak256(abi.encodePacked(
            _storeName(_pending),
            _miningKey,
            MIN_THRESHOLD
        ))] = _minThreshold;
    }

    function _setProxyStorage(address _proxyStorage) private {
        addressStorage[PROXY_STORAGE] = _proxyStorage;
    }

    function _setPendingProxyStorage(address _proxyStorage) private {
        addressStorage[PENDING_PROXY_STORAGE] = _proxyStorage;
    }

    function _confirmationsVoterAdd(address _miningKey, address _voter) private {
        addressArrayStorage[keccak256(abi.encodePacked(
            CONFIRMATIONS, _miningKey, VOTERS
        ))].push(_voter);
    }

    function _pendingProxyConfirmationsVoterAdd(
        address _newProxyAddress,
        address _voter
    ) private {
        addressArrayStorage[keccak256(abi.encodePacked(
            PENDING_PROXY_CONFIRMATIONS, _newProxyAddress, VOTERS
        ))].push(_voter);
    }

    function _validators(bool _pending, address _miningKey) private view returns (
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
        firstName = _getFirstName(_pending, _miningKey);
        lastName = _getLastName(_pending, _miningKey);
        licenseId = _getLicenseId(_pending, _miningKey);
        fullAddress = _getFullAddress(_pending, _miningKey);
        state = _getState(_pending, _miningKey);
        zipcode = _getZipcode(_pending, _miningKey);
        expirationDate = _getExpirationDate(_pending, _miningKey);
        createdDate = _getCreatedDate(_pending, _miningKey);
        updatedDate = _getUpdatedDate(_pending, _miningKey);
        minThreshold = _getMinThreshold(_pending, _miningKey);
    }

}