# poa-network-consensus-contracts

[![Build Status](https://travis-ci.org/poanetwork/poa-network-consensus-contracts.svg?branch=master)](https://travis-ci.org/poanetwork/poa-network-consensus-contracts)

## Audit
- https://www.authio.org/post/poa-network-contract-audit by Alexander Wade
- https://github.com/bokkypoobah/OraclesPoANetworkConsensusContractsAudit/tree/master/audit by Bokky PooBah

## Setup of the ceremony

### Prerequisites

- Python 3.5+, pip
- solc, the Solidity compiler

### Start POA network

- Install solidity-flattener `pip3.5 install solidity-flattener`
- Install npm dependencies `npm i`
- Generate flat sources of contracts with the script `./make_flat.sh`
- We need the byte code of `PoaNetworkConsensus_flat` contract to add it to [`spec.json`](https://github.com/poanetwork/poa-chain-spec/blob/core/spec.json) of the network. <br />
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
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_demoMode` - equal to false.
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_demoMode` - equal to false.
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_demoMode` - equal to false.
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_demoMode` - equal to false.
- `ValidatorMetadata_flat.sol` - Select contract `ValidatorMetadata`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of ValidatorMetadata contract.
-  Select deployed `ProxyStorage` contract and make a call from MoC address to `initializeAddresses` with relevant addresses.

## Unit tests
[Full Test Report](https://poanetwork.github.io/poa-network-consensus-contracts/mochawesome.html)<br />

```
  Contract: BallotsStorage [all features]
    #constructor
      ✓ sets MoC and Poa (53ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (136ms)
      ✓ cannot be set for Invalid threshold (186ms)
      ✓ new value cannot be equal to 0 (184ms)
      ✓ sets new value for Keys threshold (68ms)
      ✓ sets new value for MetadataChange threshold (71ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (278ms)
    #getProxyThreshold
      ✓ returns total number of validators (588ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (91ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (267ms)
  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (73ms)
      ✓ adds masterOfCeremony to validators hash
    #initiateKeys
      ✓ can only be called by master of ceremony (74ms)
      ✓ cannot allow 0x0 addresses (53ms)
      ✓ should not allow to initialize already initialized key (83ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (198ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (195ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (624ms)
      ✓ should increment initialKeyCount by 1 (103ms)
      ✓ should set initialKeys hash to activated status (92ms)
    #createKeys
      ✓ should only be called from initialized key (169ms)
      ✓ params should not be equal to each other (142ms)
      ✓ any of params should not be equal to initialKey (131ms)
      ✓ should assign mining, voting, payout keys to relative mappings (269ms)
      ✓ should assigns voting <-> mining key relationship (155ms)
      ✓ adds validator to poaConsensus contract (170ms)
      ✓ should set validatorKeys hash (197ms)
      ✓ should set validatorKeys hash (152ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (150ms)
      ✓ should not let add more than maxLimit (111ms)
      ✓ should set validatorKeys hash (117ms)
    #addVotingKey
      ✓ should add VotingKey (217ms)
      ✓ should only be called if mining is active (246ms)
      ✓ swaps keys if voting already exists (302ms)
    #addPayoutKey
      ✓ should add PayoutKey (180ms)
      ✓ should only be called if mining is active (259ms)
      ✓ swaps keys if voting already exists (237ms)
    #removeMiningKey
      ✓ should remove miningKey (387ms)
      ✓ removes validator from poaConsensus (413ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (332ms)
    #removeVotingKey
      ✓ should remove votingKey (332ms)
    #removePayoutKey
      ✓ should remove payoutKey (329ms)
    #swapMiningKey
      ✓ should swap mining key (300ms)
      ✓ should keep voting and payout keys (568ms)
    #swapVotingKey
      ✓ should swap voting key (285ms)
    #swapPayoutKey
      ✓ should swap payout key (282ms)
    #migrateInitialKey
      ✓ can copy initial keys (303ms)
      ✓ copies validator keys (873ms)
      ✓ throws when trying to copy invalid mining key (138ms)
  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (231ms)
      ✓ should not let create metadata if called by non-voting key (124ms)
      ✓ should not let create metadata if called second time (187ms)
    #getMiningByVotingKey
      ✓ happy path (89ms)
    #changeRequest
      ✓ happy path (228ms)
      ✓ should not let call if there is no metadata (40ms)
      ✓ resets confirmations when changeRequest recreated (686ms)
    #cancelPendingChange
      ✓ happy path (621ms)
      ✓ should not let delete records for someone else miningKey (589ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (317ms)
      ✓ should confirm changes (372ms)
      ✓ prevent from double voting (495ms)
    #finalize
      ✓ happy path (1036ms)
    #getMinThreshold
      ✓ returns default value (40ms)
    #setProxyAddress
      ✓ can request a new proxy address (510ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (125ms)
      ✓ should change implementation address (161ms)
      ✓ should increment implementation version (179ms)
      ✓ new implementation should work (171ms)
      ✓ new implementation should use the same proxyStorage address (120ms)
      ✓ new implementation should use the same storage (341ms)
  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (224ms)
      ✓ should not let create metadata if called by non-voting key (179ms)
      ✓ should not let create metadata if called second time (210ms)
    #getMiningByVotingKey
      ✓ happy path (82ms)
    #changeRequest
      ✓ happy path (267ms)
      ✓ should not let call if there is no metadata (49ms)
      ✓ resets confirmations when changeRequest recreated (655ms)
    #cancelPendingChange
      ✓ happy path (635ms)
      ✓ should not let delete records for someone else miningKey (728ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (334ms)
      ✓ should confirm changes (402ms)
      ✓ prevent from double voting (463ms)
    #finalize
      ✓ happy path (918ms)
    #getMinThreshold
      ✓ returns default value (40ms)
    #setProxyAddress
      ✓ can request a new proxy address (471ms)
  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false (40ms)
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (198ms)
    #finalizeChange
      ✓ should only be called by systemAddress (131ms)
      ✓ should set finalized to true (113ms)
      ✓ should set currentValidators to pendingList (118ms)
      ✓ set currentValidators to pendingList after addValidator call (492ms)
    #addValidator
      ✓ should be called only from keys manager (105ms)
      ✓ should not allow to add already existing validator (104ms)
      ✓ should not allow 0x0 addresses (85ms)
      ✓ should set validatorsState for new validator (134ms)
      ✓ should set finalized to false (96ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (122ms)
    #removeValidator
      ✓ should remove validator (148ms)
      ✓ should be called only from keys manager (177ms)
      ✓ should only be allowed to remove from existing set of validators (68ms)
      ✓ should decrease length of pendingList (409ms)
      ✓ should change validatorsState (185ms)
      ✓ should set finalized to false (161ms)
    #setProxyStorage
      ✓ can be called by any validator (103ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address (53ms)
      ✓ sets proxyStorage (75ms)
      ✓ sets isMasterOfCeremonyInitialized (88ms)
      ✓ emits MoCInitializedProxyStorage (104ms)
      ✓ #getKeysManager (95ms)
      ✓ #getVotingToChangeKeys (77ms)
    #isValidator
      ✓ returns address of miner
  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets MoC and Poa (49ms)
    #initializeAddresses
      ✓ sets all addresses (193ms)
      ✓ prevents Moc to call it more than once (137ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (58ms)
      ✓ cannot be set to 0x0 address
      ✓ sets keysManager (44ms)
      ✓ sets votingToChangeKeys (53ms)
      ✓ sets votingToChangeMinThreshold (67ms)
      ✓ sets votingToChangeProxy (50ms)
      ✓ sets ballotsStorage (45ms)
      ✓ sets poaConsensus (50ms)
      ✓ sets validatorMetadata (118ms)
      ✓ sets validatorMetadataEternalStorage (101ms)
  Contract: Voting to change keys [all features]
    #constructor
      ✓ happy path (568ms)
      ✓ should not let create voting with invalid duration (138ms)
      ✓ should not let create more ballots than the limit (14233ms)
    #vote
      ✓ should let a validator to vote (161ms)
      ✓ reject vote should be accepted (223ms)
      ✓ should allow multiple voters to vote (809ms)
      ✓ should not let vote nonVoting key (76ms)
      ✓ should not let vote before startTime key (129ms)
      ✓ should not let vote after endTime key (115ms)
      ✓ should not let vote with already voted key (256ms)
      ✓ should not let vote with invalid choice (240ms)
      ✓ should not let vote with invalid id (241ms)
    #finalize
      ✓ happy path - no action since it didnot meet minimum number of totalVoters (741ms)
      ✓ finalize addition of payout key (900ms)
      ✓ finalize addition of VotingKey (1137ms)
      ✓ cannot create ballot for using previous mining key (2281ms)
      ✓ finalize addition of MiningKey (1369ms)
      ✓ finalize removal of MiningKey (2228ms)
      ✓ finalize removal of VotingKey (1312ms)
      ✓ finalize removal of PayoutKey (1132ms)
      ✓ finalize swap of VotingKey (1212ms)
      ✓ finalize swap of PayoutKey (1283ms)
      ✓ finalize swap of MiningKey (1410ms)
      ✓ prevent double finalize (1788ms)
  Contract: VotingToChangeMinThreshold [all features]
    #createBallotToChangeThreshold
      ✓ happy path (260ms)
      ✓ proposed value should be more than or equal to 3 (51ms)
      ✓ proposed value should not be equal to the same value (53ms)
      ✓ should not let create more ballots than the limit (15616ms)
    #vote
      ✓ should let a validator to vote (193ms)
      ✓ reject vote should be accepted (196ms)
      ✓ should allow multiple voters to vote (420ms)
      ✓ should not let vote nonVoting key (63ms)
      ✓ should not let vote before startTime key (118ms)
      ✓ should not let vote after endTime key (118ms)
      ✓ should not let vote with already voted key (232ms)
      ✓ should not let vote with invalid choice (235ms)
      ✓ should not let vote with invalid id (218ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (646ms)
      ✓ should change to proposedValue when quorum is reached (1911ms)
      ✓ prevents double finalize (1852ms)
  Contract: VotingToChangeProxyAddress [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (259ms)
      ✓ proposed address should not be 0x0 (49ms)
      ✓ can creates multiple ballots (490ms)
      ✓ should not let create more ballots than the limit (15156ms)
    #vote
      ✓ should let a validator to vote (192ms)
      ✓ reject vote should be accepted (191ms)
      ✓ should allow multiple voters to vote (853ms)
      ✓ should not let vote nonVoting key (67ms)
      ✓ should not let vote before startTime key (137ms)
      ✓ should not let vote after endTime key (114ms)
      ✓ should not let vote with already voted key (225ms)
      ✓ should not let vote with invalid choice (210ms)
      ✓ should not let vote with invalid id (313ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (649ms)
      ✓ should change getKeysManager address (943ms)
      ✓ should change getVotingToChangeKeys (1051ms)
      ✓ should change getVotingToChangeMinThreshold (998ms)
      ✓ should change getVotingToChangeProxy (1044ms)
      ✓ should change getBallotsStorage (1075ms)
      ✓ should change getValidatorMetadata (1125ms)
      ✓ should change getValidatorMetadataEternalStorage (1100ms)
      ✓ prevents double finalize (1461ms)
  189 passing (4m)
 ```
