# poa-network-consensus-contracts

[![Build Status](https://travis-ci.org/oraclesorg/poa-network-consensus-contracts.svg?branch=master)](https://travis-ci.org/oraclesorg/poa-network-consensus-contracts)

## Setup of the ceremony

### Prerequisites

- Python 3.5+, pip
- solc, the Solidity compiler

### Start POA network

- Install solidity-flattener `pip3.5 install solidity-flattener`
- Install npm dependencies `npm i`
- Generate flat sources of contracts with the script `./make_flat.sh`
- We need the byte code of `PoaNetworkConsensus_flat` contract to add it to [`spec.json`](https://github.com/oraclesorg/oracles-chain-spec/blob/master/spec.json) of the network. <br />
Go to [Remix](http://remix.ethereum.org/#version=soljson-v0.4.18+commit.9cf6e910.js).<br />
Copy `./flat/PoaNetworkConsensus_flat.sol` source to the input field and press `Start to compile`. <br />
Choose `PoaNetworkConsensus` contract in the listbox and press "Details". Copy `BYTECODE` of the compiled source for `spec.json`.

### Add Contracts to Parity UI.

Start Parity UI. In the contracts section press `Develop` button. 
Select `0.4.18` Solidity compiler version. Set `Optimize` to `true`.

- In Parity UI `Contracts` tab choose watch custom contract. Paste bytecode and ABI of `PoaNetworkConsensus` contract from Remix.

Compile and deploy contracts in the next sequence:

- `ProxyStorage_flat.sol` - Select contract `ProxyStorage` with constructor parameters: <br />
`_poaConsensus` - address of poaConsensus contract,
`_moc` - address of Master of Ceremony. 
-  Select `poaNetworkConsensus` contract and send transaction `setProxyStorage` with the address of ProxyStorage contract.
- `KeysManager_flat.sol` - Select contract `KeysManager` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract, `_poaConsensus` - address of poaConsensus contract, `_moc` - address of Master of Ceremony.
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `ValidatorMetadata_flat.sol` - Select contract `ValidatorMetadata` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
-  Select deployed `ProxyStorage` contract and make a call from MoC address to `initializeAddresses` with relevant addresses.

## Unit tests
[Full Test Report](https://oraclesorg.github.io/poa-network-consensus-contracts/mochawesome.html)<br />

```
  Contract: BallotsStorage [all features]
    #contstuctor
      ✓ sets MoC and Poa (60ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (108ms)
      ✓ cannot be set for Invalid threshold (162ms)
      ✓ new value cannot be equal to 0 (183ms)
      ✓ sets new value for Keys threshold (69ms)
      ✓ sets new value for MetadataChange threshold (66ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (273ms)
    #getProxyThreshold
      ✓ returns total number of validators (584ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (90ms)

  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (98ms)
      ✓ adds masterOfCeremony to validators hash
    #initiateKeys
      ✓ can only be called by master of ceremony (74ms)
      ✓ cannot allow 0x0 addresses (61ms)
      ✓ should not allow to initialize already initialized key (90ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (180ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (214ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (605ms)
      ✓ should increment initialKeyCount by 1 (97ms)
      ✓ should set initialKeys hash to activated status (109ms)
    #createKeys
      ✓ should only be called from initialized key (176ms)
      ✓ params should not be equal to each other (136ms)
      ✓ any of params should not be equal to initialKey (136ms)
      ✓ should assign mining, voting, payout keys to relative mappings (235ms)
      ✓ should assigns voting <-> mining key relationship (155ms)
      ✓ adds validator to poaConsensus contract (167ms)
      ✓ should set validatorKeys hash (171ms)
      ✓ should set validatorKeys hash (171ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (191ms)
      ✓ should not let add more than maxLimit (74ms)
      ✓ should set validatorKeys hash (116ms)
    #addVotingKey
      ✓ should add VotingKey (272ms)
      ✓ should only be called if mining is active (225ms)
      ✓ swaps keys if voting already exists (316ms)
    #addPayoutKey
      ✓ should add PayoutKey (176ms)
      ✓ should only be called if mining is active (229ms)
      ✓ swaps keys if voting already exists (277ms)
    #removeMiningKey
      ✓ should remove miningKey (350ms)
      ✓ removes validator from poaConsensus (410ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (316ms)
    #removeVotingKey
      ✓ should remove votingKey (332ms)
    #removePayoutKey
      ✓ should remove payoutKey (364ms)
    #swapMiningKey
      ✓ should swap mining key (317ms)
    #swapVotingKey
      ✓ should swap voting key (322ms)
    #swapPayoutKey
      ✓ should swap payout key (252ms)

  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (134ms)
      ✓ should not let create metadata if called by non-voting key (68ms)
      ✓ should not let create metadata if called second time (167ms)
    #getMiningByVotingKey
      ✓ happy path (179ms)
    #changeRequest
      ✓ happy path (143ms)
      ✓ should not let call if there is no metadata (98ms)
    #cancelPendingChange
      ✓ happy path (436ms)
      ✓ should not let delete records for someone else miningKey (426ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (244ms)
      ✓ should confirm changes (291ms)
    #finalize
      ✓ happy path (849ms)
    #getMinThreshold
      ✓ returns default value (38ms)

  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false (52ms)
      ✓ checks systemAddress
    #finalizeChange
      ✓ should only be called by systemAddress (125ms)
      ✓ should set finalized to true (106ms)
      ✓ should set currentValidators to pendingList (129ms)
      ✓ set currentValidators to pendingList after addValidator call (532ms)
    #addValidator
      ✓ should be called only from keys manager (122ms)
      ✓ should not allow to add already existing validator (184ms)
      ✓ should not allow 0x0 addresses (97ms)
      ✓ should set validatorsState for new validator (125ms)
      ✓ should set finalized to false (110ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (127ms)
    #removeValidator
      ✓ should remove validator (153ms)
      ✓ should be called only from keys manager (193ms)
      ✓ should only be allowed to remove from existing set of validators (57ms)
      ✓ should decrease length of pendingList (446ms)
      ✓ should change validatorsState (177ms)
      ✓ should set finalized to false (201ms)
    #setProxyStorage
      ✓ can only be called from masterOfCeremony (131ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address (97ms)
      ✓ sets proxyStorage (166ms)
      ✓ sets isMasterOfCeremonyInitialized (135ms)
      ✓ emits MoCInitializedProxyStorage (111ms)
      ✓ #getKeysManager (91ms)
      ✓ #getVotingToChangeKeys (133ms)
    #isValidator
      ✓ returns address of miner (45ms)

  Contract: ProxyStorage [all features]
    #contstuctor
      ✓ sets MoC and Poa (42ms)
    #initializeAddresses
      ✓ sets all addresses (178ms)
      ✓ prevents Moc to call it more than once (103ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (62ms)
      ✓ cannot be set to 0x0 address
      ✓ sets keysManager (46ms)
      ✓ sets votingToChangeKeys (55ms)
      ✓ sets votingToChangeMinThreshold (53ms)
      ✓ sets votingToChangeProxy (55ms)
      ✓ sets ballotsStorage (52ms)

  Contract: Voting to change keys [all features]
    #constructor
      ✓ happy path (420ms)
      ✓ should not let create voting with invalid duration (137ms)
    #vote
      ✓ should let a validator to vote (196ms)
      ✓ reject vote should be accepted (195ms)
      ✓ should allow multiple voters to vote (1035ms)
      ✓ should not let vote nonVoting key (82ms)
      ✓ should not let vote before startTime key (196ms)
      ✓ should not let vote after endTime key (125ms)
      ✓ should not let vote with already voted key (280ms)
      ✓ should not let vote with invalid choice (219ms)
      ✓ should not let vote with invalid id (231ms)
    #finalize
      ✓ happy path - no action since it didnot meet minimum number of totalVoters (654ms)
      ✓ finalize addition of payout key (899ms)
      ✓ finalize addition of VotingKey (1043ms)
      ✓ finalize addition of MiningKey (1098ms)
      ✓ finalize removal of MiningKey (1284ms)
      ✓ finalize removal of VotingKey (1079ms)
      ✓ finalize removal of PayoutKey (1149ms)
      ✓ finalize swap of VotingKey (1174ms)
      ✓ finalize swap of PayoutKey (1155ms)
      ✓ finalize swap of MiningKey (1353ms)

  Contract: VotingToChangeMinThreshold [all features]
    #createBallotToChangeThreshold
      ✓ happy path (205ms)
      ✓ proposed value should be more than or equal to 3 (51ms)
      ✓ proposed value should not be equal to the same value (81ms)
    #vote
      ✓ should let a validator to vote (227ms)
      ✓ reject vote should be accepted (193ms)
      ✓ should allow multiple voters to vote (547ms)
      ✓ should not let vote nonVoting key (76ms)
      ✓ should not let vote before startTime key (184ms)
      ✓ should not let vote after endTime key (117ms)
      ✓ should not let vote with already voted key (284ms)
      ✓ should not let vote with invalid choice (231ms)
      ✓ should not let vote with invalid id (238ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (573ms)
      ✓ should change to proposedValue when quorum is reached (1172ms)

  Contract: VotingToChangeProxyAddress [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (235ms)
      ✓ proposed address should not be 0x0 (41ms)
      ✓ can creates multiple ballots (372ms)
    #vote
      ✓ should let a validator to vote (167ms)
      ✓ reject vote should be accepted (178ms)
      ✓ should allow multiple voters to vote (882ms)
      ✓ should not let vote nonVoting key (78ms)
      ✓ should not let vote before startTime key (119ms)
      ✓ should not let vote after endTime key (137ms)
      ✓ should not let vote with already voted key (275ms)
      ✓ should not let vote with invalid choice (232ms)
      ✓ should not let vote with invalid id (205ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (497ms)
      ✓ should change getKeysManager address (830ms)
      ✓ should change getVotingToChangeKeys (844ms)
      ✓ should change getVotingToChangeMinThreshold (956ms)
      ✓ should change getVotingToChangeProxy (850ms)
      ✓ should change getBallotsStorage (934ms)


  147 passing (2m)
 ```

