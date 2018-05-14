pragma solidity ^0.4.18;

import "./interfaces/IKeysManager.sol";
import "./interfaces/IVotingToChangeKeys.sol";
import "./abstracts/VotingToChange.sol";


contract VotingToChangeKeys is IVotingToChangeKeys, VotingToChange {
    enum BallotTypes {Invalid, Adding, Removal, Swap}
    enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}

    function areBallotParamsValid(
        uint256 _ballotType,
        address _affectedKey,
        uint256 _affectedKeyType,
        address _miningKey
    ) public view returns(bool) {
        if (_affectedKeyType == uint256(KeyTypes.MiningKey) && _ballotType != uint256(BallotTypes.Removal)) {
            require(!checkIfMiningExisted(_miningKey, _affectedKey));
        }
        require(_affectedKeyType > 0);
        require(_affectedKey != address(0));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        bool isMiningActive = keysManager.isMiningActive(_miningKey);
        if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
            if (_ballotType == uint256(BallotTypes.Removal)) {
                return isMiningActive;
            }
            if (_ballotType == uint256(BallotTypes.Adding)) {
                return true;
            }
        }
        require(_affectedKey != _miningKey);
        bool keyCheck;
        if (_ballotType == uint256(BallotTypes.Removal) || _ballotType == uint256(BallotTypes.Swap)) {
            if (_affectedKeyType == uint256(KeyTypes.MiningKey)) {
                return isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.VotingKey)) {
                address votingKey = keysManager.getVotingByMining(_miningKey);
                if (_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == votingKey;
                } else {
                    keyCheck = _affectedKey != votingKey;
                }
                return keysManager.isVotingActive(votingKey) && keyCheck && isMiningActive;
            }
            if (_affectedKeyType == uint256(KeyTypes.PayoutKey)) {
                address payoutKey = keysManager.getPayoutByMining(_miningKey);
                if (_ballotType == uint256(BallotTypes.Removal)) {
                    keyCheck = _affectedKey == payoutKey;
                } else {
                    keyCheck = _affectedKey != payoutKey;
                }
                return keysManager.isPayoutActive(_miningKey) && keyCheck && isMiningActive;
            }       
        }
        return true;
    }

    function checkIfMiningExisted(address _currentKey, address _affectedKey)
        public
        view
        returns(bool)
    {
        IKeysManager keysManager = IKeysManager(getKeysManager());
        uint8 maxDeep = maxOldMiningKeysDeepCheck();
        for (uint8 i = 0; i < maxDeep; i++) {
            address oldMiningKey = keysManager.getMiningKeyHistory(_currentKey);
            if (oldMiningKey == address(0)) {
                return false;
            }
            if (oldMiningKey == _affectedKey) {
                return true;
            } else {
                _currentKey = oldMiningKey;
            }
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
        string memo
    ) public {
        //only if ballotType is swap or remove
        require(areBallotParamsValid(_ballotType, _affectedKey, _affectedKeyType, _miningKey));
        uint256 ballotId = _createBallot(_ballotType, _startTime, _endTime, memo);
        _setAffectedKey(ballotId, _affectedKey);
        _setAffectedKeyType(ballotId, _affectedKeyType);
        _setMiningKey(ballotId, _miningKey);
        _setBallotType(ballotId, _ballotType);
    }

    function getAffectedKey(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "affectedKey")];
    }

    function getAffectedKeyType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "affectedKeyType")];
    }

    function getBallotType(uint256 _id) public view returns(uint256) {
        return uintStorage[keccak256(_storeName(), _id, "ballotType")];
    }

    function getMiningKey(uint256 _id) public view returns(address) {
        return addressStorage[keccak256(_storeName(), _id, "miningKey")];
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

    function _finalizeAdding(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Adding));
        IKeysManager keysManager = IKeysManager(getKeysManager());
        if (getAffectedKeyType(_id) == uint256(KeyTypes.MiningKey)) {
            keysManager.addMiningKey(getAffectedKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.VotingKey)) {
            keysManager.addVotingKey(getAffectedKey(_id), getMiningKey(_id));
        }
        if (getAffectedKeyType(_id) == uint256(KeyTypes.PayoutKey)) {
            keysManager.addPayoutKey(getAffectedKey(_id), getMiningKey(_id));
        }
    }

    function _finalizeBallotInner(uint256 _id) private {
        if (getBallotType(_id) == uint256(BallotTypes.Adding)) {
            _finalizeAdding(_id);
        } else if (getBallotType(_id) == uint256(BallotTypes.Removal)) {
            _finalizeRemoval(_id);
        } else if (getBallotType(_id) == uint256(BallotTypes.Swap)) {
            _finalizeSwap(_id);
        }
    }

    function _finalizeRemoval(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Removal));
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

    function _finalizeSwap(uint256 _id) private {
        require(getBallotType(_id) == uint256(BallotTypes.Swap));
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

    function _setAffectedKey(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "affectedKey")] = _value;
    }

    function _setAffectedKeyType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "affectedKeyType")] = _value;
    }

    function _setBallotType(uint256 _ballotId, uint256 _value) private {
        uintStorage[keccak256(_storeName(), _ballotId, "ballotType")] = _value;
    }

    function _setMiningKey(uint256 _ballotId, address _value) private {
        addressStorage[keccak256(_storeName(), _ballotId, "miningKey")] = _value;
    }

}
