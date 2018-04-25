pragma solidity ^0.4.18;
import '../../contracts/ProxyStorage.sol';

contract ProxyStorageMock is ProxyStorage {
    function ProxyStorageMock(address _poaConsensus)
    ProxyStorage(_poaConsensus)
  {
  }
    uint256 public time;
    function setTime(uint256 _time) public {
        time = _time;
    }

    function getTime() public view returns(uint256) {
      if(time == 0) {
        return now;
      } else {
        return time;
      }
    }


    function setVotingContractMock(address _newAddress) public {
        votingToChangeKeysEternalStorage = _newAddress;
    }

    function setVotingToChangeMinThresholdMock(address _newAddress) public {
        votingToChangeMinThreshold = _newAddress;
    }

    function setKeysManagerMock(address _newAddress) public {
        keysManager = _newAddress;
    }
}