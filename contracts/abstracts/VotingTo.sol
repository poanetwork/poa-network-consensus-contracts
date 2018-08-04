pragma solidity ^0.4.24;

import "../libs/SafeMath.sol";
import "../interfaces/IBallotsStorage.sol";
import "../interfaces/IKeysManager.sol";
import "../interfaces/IProxyStorage.sol";
import "../abstracts/EnumBallotTypes.sol";
import "../abstracts/EnumThresholdTypes.sol";
import "../eternal-storage/EternalStorage.sol";


contract VotingTo is EnumBallotTypes, EnumThresholdTypes, EternalStorage {
    using SafeMath for uint256;

    bytes32 internal constant OWNER = keccak256("owner");
    bytes32 internal constant INIT_DISABLED = keccak256("initDisabled");
    bytes32 internal constant NEXT_BALLOT_ID = keccak256("nextBallotId");
    bytes32 internal constant PROXY_STORAGE = keccak256("proxyStorage");

    string internal constant CREATOR = "creator";
    string internal constant END_TIME = "endTime";
    string internal constant IS_FINALIZED = "isFinalized";
    string internal constant MEMO = "memo";
    string internal constant MIN_THRESHOLD_OF_VOTERS = "minThresholdOfVoters";
    string internal constant QUORUM_STATE = "quorumState";
    string internal constant START_TIME = "startTime";
    string internal constant VOTERS = "voters";
    string internal constant VOTING_STATE = "votingState";

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
        require(msg.sender == addressStorage[OWNER]);
        _;
    }

    modifier onlyValidVotingKey(address _votingKey) {
        IKeysManager keysManager = IKeysManager(_getKeysManager());
        require(keysManager.isVotingActive(_votingKey));
        _;
    }

    function areOldMiningKeysVoted(uint256 _id, address _miningKey)
        public
        view
        returns(bool)
    {
        IKeysManager keysManager = IKeysManager(_getKeysManager());
        uint8 maxDeep = keysManager.maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_miningKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (_hasMiningKeyAlreadyVoted(_id, oldMiningKey)) {
                return true;
            } else {
                _miningKey = oldMiningKey;
            }
        }
        return false;
    }

    function getMinThresholdOfVoters(uint256 _id) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, MIN_THRESHOLD_OF_VOTERS))
        ];
    }

    function getQuorumState(uint256 _id) public view returns(uint8) {
        return uint8(uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, QUORUM_STATE))
        ]);
    }

    function getTime() public view returns(uint256) {
        return now;
    }

    function hasAlreadyVoted(uint256 _id, address _votingKey)
        public
        view
        returns(bool)
    {
        if (_votingKey == address(0)) return false;
        address miningKey = _getMiningByVotingKey(_votingKey);
        return _hasMiningKeyAlreadyVoted(_id, miningKey);
    }

    function initDisabled() public view returns(bool) {
        return boolStorage[INIT_DISABLED];
    }

    function isActive(uint256 _id) public view returns(bool) {
        return _getStartTime(_id) <= getTime() && getTime() <= _getEndTime(_id);
    }

    function isValidVote(uint256 _id, address _votingKey)
        public
        view
        returns(bool)
    {
        address miningKey = _getMiningByVotingKey(_votingKey);
        bool notVoted = !_hasMiningKeyAlreadyVoted(_id, miningKey);
        bool oldKeysNotVoted = !areOldMiningKeysVoted(_id, miningKey);
        return notVoted && isActive(_id) && oldKeysNotVoted;
    }

    function nextBallotId() public view returns(uint256) {
        return uintStorage[NEXT_BALLOT_ID];
    }

    function proxyStorage() public view returns(address) {
        return addressStorage[PROXY_STORAGE];
    }

    function _createBallot(
        uint256 _ballotType,
        uint256 _startTime,
        uint256 _endTime,
        string _memo,
        uint8 _quorumState,
        address _creatorMiningKey
    ) internal returns(uint256) {
        uint256 ballotId = nextBallotId();
        _setStartTime(ballotId, _startTime);
        _setEndTime(ballotId, _endTime);
        _setIsFinalized(ballotId, false);
        _setQuorumState(ballotId, _quorumState);
        _setMinThresholdOfVoters(ballotId, _getGlobalMinThresholdOfVoters());
        _setCreator(ballotId, _creatorMiningKey);
        _setMemo(ballotId, _memo);
        _setNextBallotId(ballotId.add(1));
        emit BallotCreated(ballotId, _ballotType, msg.sender);
        return ballotId;
    }

    function _getBallotsStorage() internal view returns(address) {
        return IProxyStorage(proxyStorage()).getBallotsStorage();
    }

    function _getCreator(uint256 _id) internal view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, CREATOR))
        ];
    }

    function _getEndTime(uint256 _id) internal view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, END_TIME))
        ];
    }

    function _getGlobalMinThresholdOfVoters() internal view returns(uint256) {
        IBallotsStorage ballotsStorage = IBallotsStorage(_getBallotsStorage());
        return ballotsStorage.getBallotThreshold(uint8(ThresholdTypes.Keys));
    }

    function _getIsFinalized(uint256 _id) internal view returns(bool) {
        return boolStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, IS_FINALIZED))
        ];
    }

    function _getKeysManager() internal view returns(address) {
        return IProxyStorage(proxyStorage()).getKeysManager();
    }

    function _getMemo(uint256 _id) internal view returns(string) {
        return stringStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, MEMO))
        ];
    }

    function _getMiningByVotingKey(address _votingKey) internal view returns(address) {
        IKeysManager keysManager = IKeysManager(_getKeysManager());
        return keysManager.getMiningKeyByVoting(_votingKey);
    }

    function _getStartTime(uint256 _id) internal view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, START_TIME))
        ];
    }

    function _hasMiningKeyAlreadyVoted(uint256 _id, address _miningKey)
        internal
        view
        returns(bool)
    {
        return boolStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, VOTERS, _miningKey))
        ];
    }

    function _setCreator(uint256 _ballotId, address _value) internal {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, CREATOR))
        ] = _value;
    }

    function _setEndTime(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, END_TIME))
        ] = _value;
    }

    function _setIsFinalized(uint256 _ballotId, bool _value) internal {
        boolStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, IS_FINALIZED))
        ] = _value;
    }

    function _setMemo(uint256 _ballotId, string _value) internal {
        stringStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, MEMO))
        ] = _value;
    }

    function _setMinThresholdOfVoters(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, MIN_THRESHOLD_OF_VOTERS))
        ] = _value;
    }

    function _setNextBallotId(uint256 _id) internal {
        uintStorage[NEXT_BALLOT_ID] = _id;
    }

    function _setQuorumState(uint256 _ballotId, uint8 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, QUORUM_STATE))
        ] = _value;
    }

    function _setStartTime(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, START_TIME))
        ] = _value;
    }

    function _votersAdd(uint256 _ballotId, address _miningKey) internal {
        boolStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, VOTERS, _miningKey))
        ] = true;
    }
}
