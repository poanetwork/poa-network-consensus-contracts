pragma solidity ^0.4.24;

import '../../contracts/ProxyStorage.sol';


contract ProxyStorageMock is ProxyStorage {
    function setVotingContractMock(address _newAddress) public {
        addressStorage[VOTING_TO_CHANGE_KEYS_ETERNAL_STORAGE] = _newAddress;
    }

    function setVotingToChangeMinThresholdMock(address _newAddress) public {
        addressStorage[VOTING_TO_CHANGE_MIN_THRESHOLD_ETERNAL_STORAGE] = _newAddress;
    }

    function setVotingToChangeProxyMock(address _newAddress) public {
        addressStorage[VOTING_TO_CHANGE_PROXY_ETERNAL_STORAGE] = _newAddress;
    }

    function setKeysManagerMock(address _newAddress) public {
        addressStorage[KEYS_MANAGER_ETERNAL_STORAGE] = _newAddress;
    }
}