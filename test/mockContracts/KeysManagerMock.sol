pragma solidity ^0.4.18;

import '../../contracts/KeysManager.sol';

contract KeysManagerMock is KeysManager {
  function KeysManagerMock(address _masterOfCeremony, address _votingContract, address _poaConsensus) KeysManager(_votingContract, _poaConsensus) {
    if(_masterOfCeremony != address(0)){
      owner = _masterOfCeremony;
    } else {
      owner = masterOfCeremony;
    }
  }
  function setMasterOfCeremony(address _newAddress) {
    masterOfCeremony = _newAddress;
  }

  function setMaxNumberOfInitialKeys(uint256 _newMax) {
    maxNumberOfInitialKeys = _newMax;
  }

  function setVotingContractMock(address _votingContract) public {
    votingContract = _votingContract;
  }

  function setPoaConsensus(address _poaConsensus) public {
    poaNetworkConsensus = PoaNetworkConsensus(_poaConsensus);
  }
}