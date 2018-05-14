pragma solidity ^0.4.18;

import "../libs/SafeMath.sol";
import "../interfaces/IBallotsStorage.sol";
import "../interfaces/IKeysManager.sol";
import "../interfaces/IProxyStorage.sol";
import "../eternal-storage/EternalStorage.sol";


contract VotingTo is EternalStorage {
    using SafeMath for uint256;

    event BallotCreated(
        uint256 indexed id,
        uint256 indexed ballotType,
        address indexed creator
    );
    event BallotFinalized(
        uint256 indexed id,
        address indexed voter
    );
    event Vote(
        uint256 indexed id,
        uint256 decision,
        address indexed voter,
        uint256 time,
        address voterMiningKey
    );

    modifier onlyOwner() {
        require(msg.sender == addressStorage[keccak256("owner")]);
        _;
    }

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function areOldMiningKeysVoted(uint256 _id, address _miningKey)
        public view returns(bool)
    {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_miningKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (hasMiningKeyAlreadyVoted(_id, oldMiningKey)) {
                return true;
            } else {
                _miningKey = oldMiningKey;
            }
        }
        return false;
    }

    function getBallotsStorage() public view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function getCreator(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "creator")];
    }

    function getEndTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "endTime")];
    }

    function getGlobalMinThresholdOfVoters() public view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(getBallotsStorage());
        return ballotsStorage.getBallotThreshold(1);
    }

    function getIsFinalized(uint256 _id) public view returns(bool) {
        return boolStorage[keccak256(_storeName(), _id, "isFinalized")];
    }

    function getKeysManager() public view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function getMemo(uint256 _id) public view returns(string) {
        return stringStorage[keccak256(_storeName(), _id, "memo")];
    }

    function getMiningByVotingKey(address _votingKey) public view returns(address) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function getMinThresholdOfVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "minThresholdOfVoters")];
    }

    function getQuorumState(uint256 _id) public view returns(uint8) {
        return uint8(uintStorage[keccak256(_storeName(), _id, "quorumState")]);
    }

    function getStartTime(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "startTime")];
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey)
        public view returns(bool)
    {
        return boolStorage[keccak256(_storeName(), _id, "voters", _miningKey)];
    }

    function hasAlreadyVoted(uint256 _id, address _votingKey)
        public view returns(bool)
    {
        address miningKey = getMiningByVotingKey(_votingKey);
        return hasMiningKeyAlreadyVoted(_id, miningKey);
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[keccak256("initDisabled")];
    }

    function isActive(uint256 _id) public view returns(bool) {
        return getStartTime(_id) <= getTime() && getTime() <= getEndTime(_id);
    }

    function isValidVote(uint256 _id, address _votingKey)
        public view returns(bool)
    {
        address miningKey = getMiningByVotingKey(_votingKey);
        bool notVoted = !hasAlreadyVoted(_id, _votingKey);
        bool oldKeysNotVoted = !areOldMiningKeysVoted(_id, miningKey);
        return notVoted && isActive(_id) && oldKeysNotVoted;
    }

    function maxOldMiningKeysDeepCheck() public pure returns(uint8) {
        return 25;
    }

    function nextBallotId() public view returns(uint256) {
        return uintStorage[keccak256("nextBallotId")];
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[keccak256("proxyStorage")];
    }

    function _setCreator(uint256 _ballotId, address _value) internal {
        addressStorage[keccak256(_storeName(), _ballotId, "creator")] = _value;
    }

    function _setEndTime(uint256 _ballotId, uint256 _value) internal {
        uintStorage[keccak256(_storeName(), _ballotId, "endTime")] = _value;
    }

    function _setIsFinalized(uint256 _ballotId, bool _value) internal {
        boolStorage[keccak256(_storeName(), _ballotId, "isFinalized")] = _value;
    }

    function _setMemo(uint256 _ballotId, string _value) internal {
        stringStorage[keccak256(_storeName(), _ballotId, "memo")] = _value;
    }

    function _setMinThresholdOfVoters(uint256 _ballotId, uint256 _value) internal {
        uintStorage[keccak256(_storeName(), _ballotId, "minThresholdOfVoters")] = _value;
    }

    function _setNextBallotId(uint256 _id) internal {
        uintStorage[keccak256("nextBallotId")] = _id;
    }

    function _setQuorumState(uint256 _ballotId, uint8 _value) internal {
        uintStorage[keccak256(_storeName(), _ballotId, "quorumState")] = _value;
    }

    function _setStartTime(uint256 _ballotId, uint256 _value) internal {
        uintStorage[keccak256(_storeName(), _ballotId, "startTime")] = _value;
    }

    function _storeName() internal pure returns(string) {
        return "votingState";
    }

    function _votersAdd(uint256 _ballotId, address _miningKey) internal {
        boolStorage[keccak256(_storeName(), _ballotId, "voters", _miningKey)] = true;
    }
}
