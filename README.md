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
- We need a bytecode of `PoaNetworkConsensus` contract to add it to [`spec.json`](https://github.com/poanetwork/poa-chain-spec/blob/core/spec.json) of the network. <br />
Go to `scripts` directory and run `poa-bytecode.js`: <br />
```bash
cd scripts
npm i
MASTER_OF_CEREMONY=0x0039F22efB07A647557C7C5d17854CFD6D489eF3 node poa-bytecode.js
```
It will show the bytecode of `PoaNetworkConsensus` contract. Copy the bytecode and paste it into `spec.json`.

### Add Contracts to Parity UI.

Start Parity UI. In the contracts section press `Develop` button. 
Select `0.4.23` Solidity compiler version. Set `Optimize` to `true`.

- In Parity UI `Contracts` tab choose watch custom contract. Paste bytecode and ABI of `PoaNetworkConsensus` contract from Remix.

Compile and deploy contracts in the next sequence:

- `ProxyStorage_flat.sol` - Select contract `ProxyStorage`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - equal to zero,
`_implementationAddress` - address of ProxyStorage contract.
-  Make a call to `ProxyStorage init` with `_poaConsensus` parameter equal to the address of poaConsensus contract, using the address of `EternalStorageProxy` and ABI of `ProxyStorage`.
-  Select `poaNetworkConsensus` contract and send transaction `setProxyStorage` with the address of ProxyStorage contract.
- `KeysManager_flat.sol` - Select contract `KeysManager`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of KeysManager contract.
-  Make a call to `KeysManager init` using the address of `EternalStorageProxy` and ABI of `KeysManager`. The parameters for `init` must be: <br />
`_poaConsensus` - address of poaConsensus contract,
`_masterOfCeremony` - address of Master of Ceremony,
`_previousKeysManager` - equal to 0x0000000000000000000000000000000000000000.
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of BallotsStorage contract.
-  Make a call to `BallotsStorage init` with `_demoMode` parameter equal to `false`, using the address of `EternalStorageProxy` and ABI of `BallotsStorage`.
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeKeys contract.
-  Make a call to `VotingToChangeKeys init` with `_demoMode` parameter equal to `false`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeKeys`.
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeMinThreshold contract.
-  Make a call to `VotingToChangeMinThreshold init` with `_demoMode` parameter equal to `false`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeMinThreshold`.
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeProxyAddress contract.
-  Make a call to `VotingToChangeProxyAddress init` with `_demoMode` parameter equal to `false`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeProxyAddress`.
- `ValidatorMetadata_flat.sol` - Select contract `ValidatorMetadata`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of ValidatorMetadata contract.
-  Select deployed `ProxyStorage` contract and make a call from MoC address to `initializeAddresses` with relevant addresses.

## Unit tests
[Full Test Report](https://poanetwork.github.io/poa-network-consensus-contracts/mochawesome.html)<br />

```
  Contract: BallotsStorage [all features]
    #init
      ✓ prevent from double init
      ✓ thresholds are correct
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (70ms)
      ✓ cannot be set for Invalid threshold (128ms)
      ✓ new value cannot be equal to 0 (156ms)
      ✓ sets new value for Keys threshold (57ms)
      ✓ sets new value for MetadataChange threshold (59ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (190ms)
    #getProxyThreshold
      ✓ returns total number of validators (406ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (70ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (242ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (140ms)
      ✓ should change implementation address (155ms)
      ✓ should increment implementation version (155ms)
      ✓ new implementation should work (207ms)
      ✓ new implementation should use the same proxyStorage address (122ms)
      ✓ new implementation should use the same storage (151ms)
  Contract: BallotsStorage upgraded [all features]
    #init
      ✓ prevent from double init
      ✓ thresholds are correct
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (53ms)
      ✓ cannot be set for Invalid threshold (110ms)
      ✓ new value cannot be equal to 0 (112ms)
      ✓ sets new value for Keys threshold (66ms)
      ✓ sets new value for MetadataChange threshold (48ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (191ms)
    #getProxyThreshold
      ✓ returns total number of validators (374ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (64ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (259ms)
  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (41ms)
      ✓ adds masterOfCeremony to validators hash (48ms)
    #initiateKeys
      ✓ can only be called by master of ceremony (56ms)
      ✓ cannot allow 0x0 addresses (42ms)
      ✓ should not allow to initialize already initialized key (60ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (126ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (119ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (434ms)
      ✓ should increment initialKeyCount by 1 (62ms)
      ✓ should set initialKeys hash to activated status (104ms)
    #createKeys
      ✓ should only be called from initialized key (120ms)
      ✓ params should not be equal to each other (92ms)
      ✓ any of params should not be equal to initialKey (140ms)
      ✓ should assign mining, voting, payout keys to relative mappings (240ms)
      ✓ should assigns voting <-> mining key relationship (115ms)
      ✓ adds validator to poaConsensus contract (169ms)
      ✓ should set validatorKeys hash (142ms)
      ✓ should set validatorKeys hash (119ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (130ms)
      ✓ should not let add more than maxLimit (52ms)
      ✓ should set validatorKeys hash (114ms)
    #addVotingKey
      ✓ should add VotingKey (184ms)
      ✓ should only be called if mining is active (158ms)
      ✓ swaps keys if voting already exists (248ms)
    #addPayoutKey
      ✓ should add PayoutKey (132ms)
      ✓ should only be called if mining is active (150ms)
      ✓ swaps keys if voting already exists (380ms)
    #removeMiningKey
      ✓ should remove miningKey (262ms)
      ✓ removes validator from poaConsensus (295ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (233ms)
    #removeVotingKey
      ✓ should remove votingKey (281ms)
    #removePayoutKey
      ✓ should remove payoutKey (268ms)
    #swapMiningKey
      ✓ should swap mining key (273ms)
      ✓ should keep voting and payout keys (479ms)
    #swapVotingKey
      ✓ should swap voting key (243ms)
    #swapPayoutKey
      ✓ should swap payout key (254ms)
    #migrateInitialKey
      ✓ can copy initial keys (289ms)
      ✓ copies validator keys (741ms)
      ✓ throws when trying to copy invalid mining key (202ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (86ms)
      ✓ should change implementation address (117ms)
      ✓ should increment implementation version (112ms)
      ✓ new implementation should work (129ms)
      ✓ new implementation should use the same proxyStorage address (94ms)
      ✓ new implementation should use the same storage (446ms)
  Contract: KeysManager upgraded [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (48ms)
      ✓ adds masterOfCeremony to validators hash (51ms)
    #initiateKeys
      ✓ can only be called by master of ceremony (47ms)
      ✓ cannot allow 0x0 addresses
      ✓ should not allow to initialize already initialized key (55ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (118ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (133ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (419ms)
      ✓ should increment initialKeyCount by 1 (64ms)
      ✓ should set initialKeys hash to activated status (106ms)
    #createKeys
      ✓ should only be called from initialized key (130ms)
      ✓ params should not be equal to each other (101ms)
      ✓ any of params should not be equal to initialKey (106ms)
      ✓ should assign mining, voting, payout keys to relative mappings (155ms)
      ✓ should assigns voting <-> mining key relationship (127ms)
      ✓ adds validator to poaConsensus contract (115ms)
      ✓ should set validatorKeys hash (177ms)
      ✓ should set validatorKeys hash (126ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (110ms)
      ✓ should not let add more than maxLimit (49ms)
      ✓ should set validatorKeys hash (114ms)
    #addVotingKey
      ✓ should add VotingKey (182ms)
      ✓ should only be called if mining is active (167ms)
      ✓ swaps keys if voting already exists (230ms)
    #addPayoutKey
      ✓ should add PayoutKey (131ms)
      ✓ should only be called if mining is active (162ms)
      ✓ swaps keys if voting already exists (215ms)
    #removeMiningKey
      ✓ should remove miningKey (262ms)
      ✓ removes validator from poaConsensus (300ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (265ms)
    #removeVotingKey
      ✓ should remove votingKey (270ms)
    #removePayoutKey
      ✓ should remove payoutKey (300ms)
    #swapMiningKey
      ✓ should swap mining key (275ms)
      ✓ should keep voting and payout keys (514ms)
    #swapVotingKey
      ✓ should swap voting key (225ms)
    #swapPayoutKey
      ✓ should swap payout key (298ms)
    #migrateInitialKey
      ✓ can copy initial keys (284ms)
      ✓ copies validator keys (775ms)
      ✓ throws when trying to copy invalid mining key (288ms)
  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (118ms)
      ✓ should not let create metadata if called by non-voting key (58ms)
      ✓ should not let create metadata if called second time (138ms)
    #getMiningByVotingKey
      ✓ happy path (53ms)
    #changeRequest
      ✓ happy path (184ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (435ms)
    #cancelPendingChange
      ✓ happy path (389ms)
      ✓ should not let delete records for someone else miningKey (435ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (253ms)
      ✓ should confirm changes (254ms)
      ✓ prevent from double voting (279ms)
    #finalize
      ✓ happy path (492ms)
    #getMinThreshold
      ✓ returns default value
    #setProxyAddress
      ✓ can request a new proxy address (326ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (80ms)
      ✓ should change implementation address (123ms)
      ✓ should increment implementation version (230ms)
      ✓ new implementation should work (135ms)
      ✓ new implementation should use the same proxyStorage address (91ms)
      ✓ new implementation should use the same storage (259ms)
  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (133ms)
      ✓ should not let create metadata if called by non-voting key (56ms)
      ✓ should not let create metadata if called second time (129ms)
    #getMiningByVotingKey
      ✓ happy path (52ms)
    #changeRequest
      ✓ happy path (164ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (425ms)
    #cancelPendingChange
      ✓ happy path (383ms)
      ✓ should not let delete records for someone else miningKey (378ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (226ms)
      ✓ should confirm changes (255ms)
      ✓ prevent from double voting (296ms)
    #finalize
      ✓ happy path (522ms)
    #getMinThreshold
      ✓ returns default value
    #setProxyAddress
      ✓ can request a new proxy address (343ms)
  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (91ms)
    #finalizeChange
      ✓ should only be called by systemAddress (80ms)
      ✓ should set finalized to true (73ms)
      ✓ should set currentValidators to pendingList (122ms)
      ✓ set currentValidators to pendingList after addValidator call (310ms)
    #addValidator
      ✓ should be called only from keys manager (75ms)
      ✓ should not allow to add already existing validator (183ms)
      ✓ should not allow 0x0 addresses (61ms)
      ✓ should set validatorsState for new validator (90ms)
      ✓ should set finalized to false (72ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (72ms)
    #removeValidator
      ✓ should remove validator (98ms)
      ✓ should be called only from keys manager (136ms)
      ✓ should only be allowed to remove from existing set of validators (49ms)
      ✓ should decrease length of pendingList (289ms)
      ✓ should change validatorsState (110ms)
      ✓ should set finalized to false (124ms)
    #setProxyStorage
      ✓ can be called by any validator (64ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address
      ✓ sets proxyStorage (99ms)
      ✓ sets isMasterOfCeremonyInitialized (60ms)
      ✓ emits MoCInitializedProxyStorage (43ms)
      ✓ #getKeysManager (59ms)
      ✓ #getVotingToChangeKeys (61ms)
    #isValidator
      ✓ returns address of miner
  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets MoC and Poa
    #initializeAddresses
      ✓ sets all addresses (170ms)
      ✓ prevents Moc to call it more than once (86ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (104ms)
      ✓ cannot be set to 0x0 address (65ms)
      ✓ sets keysManager (151ms)
      ✓ sets votingToChangeKeys (163ms)
      ✓ sets votingToChangeMinThreshold (156ms)
      ✓ sets ballotsStorage (140ms)
      ✓ sets poaConsensus (99ms)
      ✓ sets validatorMetadata (158ms)
      ✓ changes proxyStorage (itself) implementation (182ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (itself) (112ms)
      ✓ should change implementation address (112ms)
      ✓ should increment implementation version (140ms)
      ✓ new implementation should work (172ms)
      ✓ new implementation should use the same storage (128ms)
  Contract: ProxyStorage upgraded [all features]
    #constructor
      ✓ sets MoC and Poa
    #initializeAddresses
      ✓ sets all addresses (204ms)
      ✓ prevents Moc to call it more than once (86ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (90ms)
      ✓ cannot be set to 0x0 address (63ms)
      ✓ sets keysManager (145ms)
      ✓ sets votingToChangeKeys (189ms)
      ✓ sets votingToChangeMinThreshold (154ms)
      ✓ sets ballotsStorage (156ms)
      ✓ sets poaConsensus (100ms)
      ✓ sets validatorMetadata (180ms)
      ✓ changes proxyStorage (itself) implementation (173ms)
  Contract: Voting to change keys [all features]
    #constructor
      ✓ happy path (438ms)
      ✓ should not let create voting with invalid duration (101ms)
      ✓ should not let create more ballots than the limit (9607ms)
    #vote
      ✓ should let a validator to vote (149ms)
      ✓ reject vote should be accepted (141ms)
      ✓ should allow multiple voters to vote (724ms)
      ✓ should not let vote nonVoting key (52ms)
      ✓ should not let vote before startTime key (109ms)
      ✓ should not let vote after endTime key (106ms)
      ✓ should not let vote with already voted key (197ms)
      ✓ should not let vote with invalid choice (180ms)
      ✓ should not let vote with invalid id (185ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (820ms)
      ✓ finalize addition of payout key (971ms)
      ✓ finalize addition of VotingKey (1069ms)
      ✓ cannot create ballot for using previous mining key (2239ms)
      ✓ finalize addition of MiningKey (1129ms)
      ✓ finalize removal of MiningKey (1177ms)
      ✓ finalize removal of VotingKey (1170ms)
      ✓ finalize removal of PayoutKey (1150ms)
      ✓ finalize swap of VotingKey (1143ms)
      ✓ finalize swap of PayoutKey (1165ms)
      ✓ finalize swap of MiningKey (1322ms)
      ✓ prevent double finalize (1390ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (123ms)
      ✓ should change implementation address (126ms)
      ✓ should increment implementation version (122ms)
      ✓ new implementation should work (162ms)
      ✓ new implementation should use the same proxyStorage address (96ms)
      ✓ new implementation should use the same storage (955ms)
  Contract: Voting to change keys upgraded [all features]
    #constructor
      ✓ happy path (373ms)
      ✓ should not let create voting with invalid duration (103ms)
      ✓ should not let create more ballots than the limit (9631ms)
    #vote
      ✓ should let a validator to vote (145ms)
      ✓ reject vote should be accepted (183ms)
      ✓ should allow multiple voters to vote (768ms)
      ✓ should not let vote nonVoting key (54ms)
      ✓ should not let vote before startTime key (93ms)
      ✓ should not let vote after endTime key (103ms)
      ✓ should not let vote with already voted key (188ms)
      ✓ should not let vote with invalid choice (189ms)
      ✓ should not let vote with invalid id (219ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (798ms)
      ✓ finalize addition of payout key (934ms)
      ✓ finalize addition of VotingKey (1105ms)
      ✓ cannot create ballot for using previous mining key (2196ms)
      ✓ finalize addition of MiningKey (1120ms)
      ✓ finalize removal of MiningKey (1194ms)
      ✓ finalize removal of VotingKey (1138ms)
      ✓ finalize removal of PayoutKey (1137ms)
      ✓ finalize swap of VotingKey (1210ms)
      ✓ finalize swap of PayoutKey (1192ms)
      ✓ finalize swap of MiningKey (1298ms)
      ✓ prevent double finalize (1449ms)
  Contract: VotingToChangeMinThreshold [all features]
    #createBallotToChangeThreshold
      ✓ happy path (316ms)
      ✓ proposed value should be more than or equal to 3 (39ms)
      ✓ proposed value should not be equal to the same value (49ms)
      ✓ should not let create more ballots than the limit (9463ms)
    #vote
      ✓ should let a validator to vote (141ms)
      ✓ reject vote should be accepted (195ms)
      ✓ should allow multiple voters to vote (408ms)
      ✓ should not let vote nonVoting key (56ms)
      ✓ should not let vote before startTime key (108ms)
      ✓ should not let vote after endTime key (100ms)
      ✓ should not let vote with already voted key (198ms)
      ✓ should not let vote with invalid choice (180ms)
      ✓ should not let vote with invalid id (187ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (650ms)
      ✓ should change to proposedValue when quorum is reached (1362ms)
      ✓ prevents double finalize (1535ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (80ms)
      ✓ should change implementation address (148ms)
      ✓ should increment implementation version (110ms)
      ✓ new implementation should work (118ms)
      ✓ new implementation should use the same proxyStorage address (88ms)
      ✓ new implementation should use the same storage (463ms)
  Contract: VotingToChangeMinThreshold upgraded [all features]
    #createBallotToChangeThreshold
      ✓ happy path (308ms)
      ✓ proposed value should be more than or equal to 3 (40ms)
      ✓ proposed value should not be equal to the same value (51ms)
      ✓ should not let create more ballots than the limit (9581ms)
    #vote
      ✓ should let a validator to vote (139ms)
      ✓ reject vote should be accepted (154ms)
      ✓ should allow multiple voters to vote (364ms)
      ✓ should not let vote nonVoting key (53ms)
      ✓ should not let vote before startTime key (103ms)
      ✓ should not let vote after endTime key (165ms)
      ✓ should not let vote with already voted key (192ms)
      ✓ should not let vote with invalid choice (224ms)
      ✓ should not let vote with invalid id (234ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (615ms)
      ✓ should change to proposedValue when quorum is reached (1228ms)
      ✓ prevents double finalize (1434ms)
  Contract: VotingToChangeProxyAddress [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (328ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (510ms)
      ✓ should not let create more ballots than the limit (9297ms)
    #vote
      ✓ should let a validator to vote (141ms)
      ✓ reject vote should be accepted (142ms)
      ✓ should allow multiple voters to vote (804ms)
      ✓ should not let vote nonVoting key (49ms)
      ✓ should not let vote before startTime key (134ms)
      ✓ should not let vote after endTime key (108ms)
      ✓ should not let vote with already voted key (194ms)
      ✓ should not let vote with invalid choice (185ms)
      ✓ should not let vote with invalid id (187ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (697ms)
      ✓ should change KeysManager implementation (952ms)
      ✓ should change VotingToChangeKeys implementation (1097ms)
      ✓ should change VotingToChangeMinThreshold implementation (1012ms)
      ✓ should change VotingToChangeProxy implementation (1104ms)
      ✓ should change BallotsStorage implementation (1010ms)
      ✓ should change ValidatorMetadata implementation (1093ms)
      ✓ should change ProxyStorage implementation (1021ms)
      ✓ prevents double finalize (1537ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (92ms)
      ✓ should change implementation address (117ms)
      ✓ should increment implementation version (122ms)
      ✓ new implementation should work (213ms)
      ✓ new implementation should use the same proxyStorage address (97ms)
      ✓ new implementation should use the same storage (592ms)
  Contract: VotingToChangeProxyAddress upgraded [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (346ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (460ms)
      ✓ should not let create more ballots than the limit (9227ms)
    #vote
      ✓ should let a validator to vote (144ms)
      ✓ reject vote should be accepted (158ms)
      ✓ should allow multiple voters to vote (855ms)
      ✓ should not let vote nonVoting key (47ms)
      ✓ should not let vote before startTime key (102ms)
      ✓ should not let vote after endTime key (112ms)
      ✓ should not let vote with already voted key (189ms)
      ✓ should not let vote with invalid choice (182ms)
      ✓ should not let vote with invalid id (187ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (703ms)
      ✓ should change KeysManager implementation (917ms)
      ✓ should change VotingToChangeKeys implementation (1002ms)
      ✓ should change VotingToChangeMinThreshold implementation (1033ms)
      ✓ should change VotingToChangeProxy implementation (1013ms)
      ✓ should change BallotsStorage implementation (1006ms)
      ✓ should change ValidatorMetadata implementation (1157ms)
      ✓ should change ProxyStorage implementation (1020ms)
      ✓ prevents double finalize (1504ms)
  349 passing (8m)
 ```
