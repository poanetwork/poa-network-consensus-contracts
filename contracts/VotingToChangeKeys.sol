pragma solidity ^0.4.24;

import "./interfaces/IKeysManager.sol";
import "./interfaces/IVotingToChangeKeys.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeKeys is IVotingToChangeKeys, VotingToChange {
    string internal constant AFFECTED_KEY = "affectedKey";
    string internal constant AFFECTED_KEY_TYPE = "affectedKeyType";
    string internal constant BALLOT_TYPE = "ballotType";
    string internal constant MINING_KEY = "miningKey";
    string internal constant NEW_PAYOUT_KEY = "newPayoutKey";
    string internal constant NEW_VOTING_KEY = "newVotingKey";

    enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}

    // solhint-disable code-complexity, function-max-lines
    function areBallotParamsValid(
        uint256 _ballotType,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) public view returns(bool) {
        require(_ballotType >= uint256(BallotTypes.KeyAdding));
        require(_ballotType <= uint256(BallotTypes.KeySwap));
        require(_affectedKey != address(0));
        require(_affectedKeyType >= uint256(KeyTypes.MiningKey));
        require(_affectedKeyType <= uint256(KeyTypes.PayoutKey));

        IKeysManager keysManager = IKeysManager(getKeysManager());
        address key;

        if (_ballotType == uint256(BallotTypes.KeyAdding)) {
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return !checkIfMiningExisted(_miningKey, _affectedKey);
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                require(_miningKey != keysManager.masterOfCeremony());
                return _affectedKey != _miningKey;
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                return _affectedKey != _miningKey;
            }
        }

        require(keysManager.isMiningActive(_miningKey));

        if (_ballotType == uint256(BallotTypes.KeyRemoval)) {
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return true;
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                require(_affectedKey != _miningKey);
                key = keysManager.getVotingByMining(_miningKey);
                require(_affectedKey == key);
                return keysManager.isVotingActive(key);
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                require(_affectedKey != _miningKey);
                key = keysManager.getPayoutByMining(_miningKey);
                require(_affectedKey == key);
                return keysManager.isPayoutActive(_miningKey);
            }
        }

        if (_ballotType == uint256(BallotTypes.KeySwap)) {
            require(_affectedKey != _miningKey);
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return !checkIfMiningExisted(_miningKey, _affectedKey);
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                key = keysManager.getVotingByMining(_miningKey);
                require(_affectedKey != key);
                return keysManager.isVotingActive(key);
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                key = keysManager.getPayoutByMining(_miningKey);
                require(_affectedKey != key);
                return keysManager.isPayoutActive(_miningKey);
            }
        }
    }
    // solhint-enable code-complexity, function-max-lines

    function checkIfMiningExisted(address _currentKey, address _newKey)
        public
        view
        returns(bool)
    {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        
        if (keysManager.isMiningActive(_newKey)) {
            return true;
        }

        if (_currentKey == address(0)) {
            return false;
        }
        
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_currentKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (oldMiningKey == _newKey) {
                return true;
            }
            _currentKey = oldMiningKey;
        }
        
        return false;
    }

    function createBallot(
        uint256 _startTime,
        uint256 _endTime,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey,
        uint256 _ballotType,
        string _memo
    ) public returns(uint256) {
        require(areBallotParamsValid(
            _ballotType,
            _affectedKey,
            _affectedKeyType,
            _miningKey
        ));
        uint256 ballotId = _createBallot(_ballotType, _startTime, _endTime, _memo);
        _setAffectedKey(ballotId, _affectedKey);
        _setAffectedKeyType(ballotId, _affectedKeyType);
        _setMiningKey(ballotId, _miningKey);
        _setBallotType(ballotId, _ballotType);
        return ballotId;
    }

    function createBallotToAddNewValidator(
        uint256 _startTime,
        uint256 _endTime,
        address _newMiningKey,
        address _newVotingKey,
        address _newPayoutKey,
        string _memo
    ) public returns(uint256) {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        require(keysManager.miningKeyByVoting(_newVotingKey) == address(0));
        require(keysManager.miningKeyByPayout(_newPayoutKey) == address(0));
        uint256 ballotId = createBallot(
            _startTime,
            _endTime,
            _newMiningKey, // _affectedKey
            uint256(KeyTypes.MiningKey), // _affectedKeyType
            address(0), // _miningKey
            uint256(BallotTypes.KeyAdding), // _ballotType
            _memo
        );
        _setNewVotingKey(ballotId, _newVotingKey);
        _setNewPayoutKey(ballotId, _newPayoutKey);
        return ballotId;
    }

    function getAffectedKey(uint256 _id) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, AFFECTED_KEY))
        ];
    }

    function getAffectedKeyType(uint256 _id) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, AFFECTED_KEY_TYPE))
        ];
    }

    function getBallotType(uint256 _id) public view returns(uint256) {
        return uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, BALLOT_TYPE))
        ];
    }

    function getMiningKey(uint256 _id) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, MINING_KEY))
        ];
    }

    function getNewPayoutKey(uint256 _id) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, NEW_PAYOUT_KEY))
        ];
    }

    function getNewVotingKey(uint256 _id) public view returns(address) {
        return addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _id, NEW_VOTING_KEY))
        ];
    }

    function migrateBasicOne(
        uint256 _id,
        address _prevVotingToChange,
        uint8 _quorumState,
        uint256 _index,
        address _creator,
        string _memo,
        address[] _voters
    ) public {
        _migrateBasicOne(
            _id,
            _prevVotingToChange,
            _quorumState,
            _index,
            _creator,
            _memo,
            _voters
        );
        IVotingToChangeKeys prev = IVotingToChangeKeys(_prevVotingToChange);
        _setBallotType(_id, prev.getBallotType(_id));
        _setAffectedKey(_id, prev.getAffectedKey(_id));
        _setAffectedKeyType(_id, prev.getAffectedKeyType(_id));
        _setMiningKey(_id, prev.getMiningKey(_id));
    }

    function _finalizeAdding(uint256 _id) internal {
        require(getBallotType(_id) == uint256(BallotTypes.KeyAdding));
        IKeysManager keysManager = IKeysManager(getKeysManager());

        address affectedKey = getAffectedKey(_id);
        uint256 affectedKeyType = getAffectedKeyType(_id);
        
        if (affectedKeyType == uint256(KeyTypes.MiningKey)) {
            keysManager.addMiningKey(affectedKey);

            address newVotingKey = getNewVotingKey(_id);
            if (newVotingKey != address(0)) {
                keysManager.addVotingKey(newVotingKey, affectedKey);
            }

            address newPayoutKey = getNewPayoutKey(_id);
            if (newPayoutKey != address(0)) {
                keysManager.addPayoutKey(newPayoutKey, affectedKey);
            }
        } else if (affectedKeyType == uint256(KeyTypes.VotingKey)) {
            keysManager.addVotingKey(affectedKey, getMiningKey(_id));
        } else if (affectedKeyType == uint256(KeyTypes.PayoutKey)) {
            keysManager.addPayoutKey(affectedKey, getMiningKey(_id));
        }
    }

    function _finalizeBallotInner(uint256 _id) internal {
        if (getBallotType(_id) == uint256(BallotTypes.KeyAdding)) {
            _finalizeAdding(_id);
        } else if (getBallotType(_id) == uint256(BallotTypes.KeyRemoval)) {
            _finalizeRemoval(_id);
        } else if (getBallotType(_id) == uint256(BallotTypes.KeySwap)) {
            _finalizeSwap(_id);
        }
    }

    function _finalizeRemoval(uint256 _id) internal {
        require(getBallotType(_id) == uint256(BallotTypes.KeyRemoval));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.removeMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.removeVotingKey(getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.removePayoutKey(getMiningKey(_id));
        }
    }

    function _finalizeSwap(uint256 _id) internal {
        require(getBallotType(_id) == uint256(BallotTypes.KeySwap));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.swapMiningKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.swapVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.swapPayoutKey(getAffectedKey(_id), getMiningKey(_id));
        }
    }

    function _setAffectedKey(uint256 _ballotId, address _value) internal {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, AFFECTED_KEY))
        ] = _value;
    }

    function _setAffectedKeyType(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, AFFECTED_KEY_TYPE))
        ] = _value;
    }

    function _setBallotType(uint256 _ballotId, uint256 _value) internal {
        uintStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, BALLOT_TYPE))
        ] = _value;
    }

    function _setMiningKey(uint256 _ballotId, address _value) internal {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, MINING_KEY))
        ] = _value;
    }

    function _setNewPayoutKey(uint256 _ballotId, address _value) internal {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, NEW_PAYOUT_KEY))
        ] = _value;
    }

    function _setNewVotingKey(uint256 _ballotId, address _value) internal {
        addressStorage[
            keccak256(abi.encodePacked(VOTING_STATE, _ballotId, NEW_VOTING_KEY))
        ] = _value;
    }

}
