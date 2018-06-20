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
$ cd scripts
$ npm i
$ MASTER_OF_CEREMONY=0x0039F22efB07A647557C7C5d17854CFD6D489eF3 node poa-bytecode.js
```
It will show the bytecode of `PoaNetworkConsensus` contract. Copy the bytecode and paste it into `spec.json`.

### Add Contracts to Parity UI.

Start Parity UI. In the contracts section press `Develop` button. 
Select `0.4.24` Solidity compiler version. Set `Optimize` to `true`.

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
-  Make a call to `KeysManager init` with `_previousKeysManager` parameter equal to 0x0000000000000000000000000000000000000000, using the address of `EternalStorageProxy` and ABI of `KeysManager`.
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of BallotsStorage contract.
-  Make a call to `BallotsStorage init` with `_thresholds` parameter equal to [3, 2], using the address of `EternalStorageProxy` and ABI of `BallotsStorage`.
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeKeys contract.
-  Make a call to `VotingToChangeKeys init` with `_minBallotDuration` parameter equal to `172800`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeKeys`.
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeMinThreshold contract.
-  Make a call to `VotingToChangeMinThreshold init` with `_minBallotDuration` parameter equal to `172800` and `_minPossibleThreshold` parameter equal to `3`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeMinThreshold`.
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress`.
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeProxyAddress contract.
-  Make a call to `VotingToChangeProxyAddress init` with `_minBallotDuration` parameter equal to `172800`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeProxyAddress`.
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
      ✓ prevent from double init (40ms)
      ✓ thresholds are correct (39ms)
    #migrate
      ✓ should copy thresholds from an old contract (253ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (55ms)
      ✓ cannot be set for Invalid threshold (102ms)
      ✓ new value cannot be equal to 0 (110ms)
      ✓ sets new value for Keys threshold (55ms)
      ✓ sets new value for MetadataChange threshold (50ms)
    #getProxyThreshold
      ✓ return value is correct (394ms)
      ✓ return value is correct if MoC is removed (1192ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (62ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (241ms)
      ✓ returns correct limit if MoC is removed (1064ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (108ms)
      ✓ should change implementation address (139ms)
      ✓ should increment implementation version (139ms)
      ✓ new implementation should work (180ms)
      ✓ new implementation should use the same proxyStorage address (121ms)
      ✓ new implementation should use the same storage (171ms)
  Contract: BallotsStorage upgraded [all features]
    #init
      ✓ prevent from double init
      ✓ thresholds are correct
    #migrate
      ✓ should copy thresholds from an old contract (223ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (56ms)
      ✓ cannot be set for Invalid threshold (92ms)
      ✓ new value cannot be equal to 0 (120ms)
      ✓ sets new value for Keys threshold
      ✓ sets new value for MetadataChange threshold (58ms)
    #getProxyThreshold
      ✓ return value is correct (345ms)
      ✓ return value is correct if MoC is removed (1380ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (56ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (240ms)
      ✓ returns correct limit if MoC is removed (989ms)
  Contract: BlockReward [all features]
    constructor
      ✓ should save parameters
    #reward
      ✓ may be called only by system address (92ms)
      ✓ should revert if input array contains more than one item
      ✓ should revert if lengths of input arrays are not equal (46ms)
      ✓ should revert if `kind` parameter is not 0
      ✓ should revert if mining key does not exist (195ms)
      ✓ should assign rewards to payout key and EmissionFunds (78ms)
      ✓ should assign reward to mining key if payout key is 0 (113ms)
      ✓ should assign reward only to payout key if emissionFundsAmount is 0 (98ms)
  Contract: EmissionFunds [all features]
    #sendFundsTo
      ✓ should fail if receiver address is not full (578ms)
  Contract: EternalStorageProxy [all features]
    constructor
      ✓ should revert if implementation address is equal to 0x0
      ✓ should allow ProxyStorage address equal to 0x0 (59ms)
      ✓ should set ProxyStorage address (46ms)
      ✓ should set implementation address (40ms)
      ✓ should set owner (57ms)
    #renounceOwnership
      ✓ may only be called by an owner (44ms)
      ✓ should set owner to 0x0
    #transferOwnership
      ✓ may only be called by an owner (45ms)
      ✓ should change owner
      ✓ should not change owner if its address is 0x0
    #upgradeTo
      ✓ may only be called by ProxyStorage
      ✓ should not change implementation address if it is the same
      ✓ should not change implementation address if it is 0x0
      ✓ should change implementation address
      ✓ should increment version
  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (49ms)
      ✓ adds masterOfCeremony to validators hash (45ms)
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (68ms)
      ✓ cannot allow 0x0 addresses (69ms)
      ✓ should not allow to initialize already initialized key (80ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (142ms)
      ✓ should not equal to master of ceremony (45ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (593ms)
      ✓ should increment initialKeyCount by 1 (84ms)
      ✓ should set initialKeys hash to activated status (92ms)
    #createKeys
      ✓ should only be called from initialized key (125ms)
      ✓ params should not be equal to 0x0 (183ms)
      ✓ params should not be equal to each other (113ms)
      ✓ any of params should not be equal to initialKey (206ms)
      ✓ should assign mining, voting, payout keys to relative mappings (158ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (144ms)
      ✓ adds validator to poaConsensus contract (150ms)
      ✓ should set validatorKeys hash (165ms)
      ✓ should set validatorKeys hash (143ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (67ms)
      ✓ should only be called from votingToChangeKeys (109ms)
      ✓ should not let add more than maxLimit (59ms)
      ✓ should set validatorKeys hash (109ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (117ms)
      ✓ may only be called if params are not the same (221ms)
      ✓ should add VotingKey (152ms)
      ✓ should only be called if mining is active (174ms)
      ✓ swaps keys if voting already exists (262ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (119ms)
      ✓ may only be called if params are not the same (144ms)
      ✓ should add PayoutKey (158ms)
      ✓ should only be called if mining is active (172ms)
      ✓ swaps keys if voting already exists (280ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (155ms)
      ✓ should remove miningKey (333ms)
      ✓ removes validator from poaConsensus (249ms)
      ✓ removes MoC from poaConsensus (835ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (280ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (220ms)
      ✓ should be successful only for active voting key (222ms)
      ✓ should remove votingKey (277ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (202ms)
      ✓ should be successful only for active payout key (252ms)
      ✓ should remove payoutKey (274ms)
    #swapMiningKey
      ✓ should swap mining key (310ms)
      ✓ should swap MoC (242ms)
      ✓ should keep voting and payout keys (483ms)
    #swapVotingKey
      ✓ should swap voting key (243ms)
    #swapPayoutKey
      ✓ should swap payout key (262ms)
    #migrateInitialKey
      ✓ can copy initial keys (378ms)
    #migrateMiningKey
      ✓ copies validator keys (1275ms)
      ✓ throws when trying to copy invalid mining key (189ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (87ms)
      ✓ should change implementation address (192ms)
      ✓ should increment implementation version (107ms)
      ✓ new implementation should work (121ms)
      ✓ new implementation should use the same proxyStorage address (77ms)
      ✓ new implementation should use the same storage (423ms)
  Contract: KeysManager upgraded [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (57ms)
      ✓ adds masterOfCeremony to validators hash (46ms)
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (79ms)
      ✓ cannot allow 0x0 addresses (54ms)
      ✓ should not allow to initialize already initialized key (70ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (160ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (816ms)
      ✓ should increment initialKeyCount by 1 (63ms)
      ✓ should set initialKeys hash to activated status (77ms)
    #createKeys
      ✓ should only be called from initialized key (138ms)
      ✓ params should not be equal to 0x0 (270ms)
      ✓ params should not be equal to each other (105ms)
      ✓ any of params should not be equal to initialKey (105ms)
      ✓ should assign mining, voting, payout keys to relative mappings (167ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (145ms)
      ✓ adds validator to poaConsensus contract (133ms)
      ✓ should set validatorKeys hash (164ms)
      ✓ should set validatorKeys hash (136ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (157ms)
      ✓ should only be called from votingToChangeKeys (107ms)
      ✓ should not let add more than maxLimit (39ms)
      ✓ should set validatorKeys hash (113ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (117ms)
      ✓ may only be called if params are not the same (137ms)
      ✓ should add VotingKey (154ms)
      ✓ should only be called if mining is active (188ms)
      ✓ swaps keys if voting already exists (269ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (116ms)
      ✓ may only be called if params are not the same (132ms)
      ✓ should add PayoutKey (161ms)
      ✓ should only be called if mining is active (166ms)
      ✓ swaps keys if voting already exists (274ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (169ms)
      ✓ should remove miningKey (333ms)
      ✓ removes validator from poaConsensus (265ms)
      ✓ removes MoC from poaConsensus (899ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (273ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (287ms)
      ✓ should be successful only for active voting key (222ms)
      ✓ should remove votingKey (280ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (198ms)
      ✓ should be successful only for active payout key (221ms)
      ✓ should remove payoutKey (266ms)
    #swapMiningKey
      ✓ should swap mining key (311ms)
      ✓ should swap MoC (249ms)
      ✓ should keep voting and payout keys (460ms)
    #swapVotingKey
      ✓ should swap voting key (243ms)
    #swapPayoutKey
      ✓ should swap payout key (266ms)
    #migrateInitialKey
      ✓ can copy initial keys (372ms)
    #migrateMiningKey
      ✓ copies validator keys (1009ms)
      ✓ throws when trying to copy invalid mining key (222ms)
  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (156ms)
      ✓ should not let create metadata if called by non-voting key (64ms)
      ✓ should not let create metadata if called second time (157ms)
    #initMetadata
      ✓ happy path (394ms)
    #getMiningByVotingKey
      ✓ happy path (45ms)
    #changeRequest
      ✓ happy path (158ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (454ms)
    #cancelPendingChange
      ✓ happy path (464ms)
      ✓ should not let delete records for someone else miningKey (519ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (262ms)
      ✓ should confirm changes (292ms)
      ✓ prevent from double voting (305ms)
    #finalize
      ✓ happy path (691ms)
    #getMinThreshold
      ✓ returns default value
    #setProxyAddress
      ✓ can request a new proxy address (377ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (89ms)
      ✓ should change implementation address (106ms)
      ✓ should increment implementation version (107ms)
      ✓ new implementation should work (112ms)
      ✓ new implementation should use the same proxyStorage address (80ms)
      ✓ new implementation should use the same storage (274ms)
  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (156ms)
      ✓ should not let create metadata if called by non-voting key (65ms)
      ✓ should not let create metadata if called second time (139ms)
    #initMetadata
      ✓ happy path (556ms)
    #getMiningByVotingKey
      ✓ happy path (38ms)
    #changeRequest
      ✓ happy path (171ms)
      ✓ should not let call if there is no metadata (39ms)
      ✓ resets confirmations when changeRequest recreated (601ms)
    #cancelPendingChange
      ✓ happy path (531ms)
      ✓ should not let delete records for someone else miningKey (446ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (257ms)
      ✓ should confirm changes (301ms)
      ✓ prevent from double voting (311ms)
    #finalize
      ✓ happy path (658ms)
    #getMinThreshold
      ✓ returns default value
    #setProxyAddress
      ✓ can request a new proxy address (370ms)
  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (79ms)
    #finalizeChange
      ✓ should only be called by systemAddress (66ms)
      ✓ should set finalized to true (63ms)
      ✓ should set currentValidators to pendingList (70ms)
      ✓ set currentValidators to pendingList after addValidator call (273ms)
    #addValidator
      ✓ should be called only from keys manager (69ms)
      ✓ should not allow to add already existing validator (73ms)
      ✓ should not allow 0x0 addresses (59ms)
      ✓ should set validatorsState for new validator (72ms)
      ✓ should set finalized to false (49ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (69ms)
    #swapValidatorKey
      ✓ should swap validator key (263ms)
      ✓ should swap MoC (261ms)
    #removeValidator
      ✓ should remove validator (105ms)
      ✓ should remove MoC (313ms)
      ✓ should be called only from keys manager (109ms)
      ✓ should only be allowed to remove from existing set of validators
      ✓ should decrease length of pendingList (230ms)
      ✓ should change validatorsState (97ms)
      ✓ should set finalized to false (90ms)
    #setProxyStorage
      ✓ can be called by any validator (47ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address
      ✓ sets proxyStorage (41ms)
      ✓ sets isMasterOfCeremonyInitialized (142ms)
      ✓ emits MoCInitializedProxyStorage (42ms)
      ✓ #getKeysManager (51ms)
    #isValidator
      ✓ returns true for validator
    #isValidatorFinalized
      ✓ returns true for finalized validator (1434ms)
  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets MoC and Poa
    #initializeAddresses
      ✓ sets all addresses (128ms)
      ✓ prevents Moc to call it more than once (87ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (174ms)
      ✓ cannot be set to 0x0 address (57ms)
      ✓ sets keysManager (128ms)
      ✓ sets votingToChangeKeys (150ms)
      ✓ sets votingToChangeMinThreshold (141ms)
      ✓ sets ballotsStorage (125ms)
      ✓ sets poaConsensus (73ms)
      ✓ sets validatorMetadata (228ms)
      ✓ changes proxyStorage (itself) implementation (151ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (itself) (116ms)
      ✓ should change implementation address (105ms)
      ✓ should increment implementation version (178ms)
      ✓ new implementation should work (131ms)
      ✓ new implementation should use the same storage (106ms)
  Contract: ProxyStorage upgraded [all features]
    #constructor
      ✓ sets MoC and Poa
    #initializeAddresses
      ✓ sets all addresses (180ms)
      ✓ prevents Moc to call it more than once (80ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (103ms)
      ✓ cannot be set to 0x0 address (57ms)
      ✓ sets keysManager (140ms)
      ✓ sets votingToChangeKeys (390ms)
      ✓ sets votingToChangeMinThreshold (134ms)
      ✓ sets ballotsStorage (132ms)
      ✓ sets poaConsensus (75ms)
      ✓ sets validatorMetadata (132ms)
      ✓ changes proxyStorage (itself) implementation (147ms)
  Contract: Voting to change keys [all features]
    #createBallot
      ✓ happy path (498ms)
      ✓ should not let create voting with invalid duration (149ms)
      ✓ should not let add votingKey for MoC (416ms)
      ✓ should not let create more ballots than the limit (9707ms)
    #createBallotToAddNewValidator
      ✓ happy path (435ms)
      ✓ deny adding already existed voting key
      ✓ deny adding already existed payout key (194ms)
      ✓ should create validator with all keys after finalization (1348ms)
      ✓ should allow removing new validator if finalizeChange did not happen (2172ms)
    #vote
      ✓ should let a validator to vote (150ms)
      ✓ reject vote should be accepted (147ms)
      ✓ should allow multiple voters to vote (806ms)
      ✓ should not let vote nonVoting key (57ms)
      ✓ should not let vote before startTime key (94ms)
      ✓ should not let vote after endTime key (98ms)
      ✓ should not let vote with already voted key (195ms)
      ✓ should not let vote with invalid choice (171ms)
      ✓ should not let vote with invalid id (179ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (861ms)
      ✓ finalize addition of payout key (1003ms)
      ✓ finalize addition of VotingKey (1074ms)
      ✓ cannot create ballot for using previous mining key (2363ms)
      ✓ finalize addition of MiningKey (1097ms)
      ✓ finalize removal of MiningKey (1320ms)
      ✓ finalize removal of VotingKey (1264ms)
      ✓ finalize removal of PayoutKey (1193ms)
      ✓ finalize swap of VotingKey (1146ms)
      ✓ finalize swap of PayoutKey (1138ms)
      ✓ finalize swap of MiningKey (1415ms)
      ✓ prevent double finalize (1672ms)
      ✓ allowed at once after all validators gave their votes (1443ms)
    #migrate
      ✓ should copy a ballot to the new contract (1262ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (93ms)
      ✓ should change implementation address (269ms)
      ✓ should increment implementation version (111ms)
      ✓ new implementation should work (120ms)
      ✓ new implementation should use the same proxyStorage address (96ms)
      ✓ new implementation should use the same storage (918ms)
  Contract: Voting to change keys upgraded [all features]
    #createBallot
      ✓ happy path (550ms)
      ✓ should not let create voting with invalid duration (172ms)
      ✓ should not let add votingKey for MoC (437ms)
      ✓ should not let create more ballots than the limit (9842ms)
    #createBallotToAddNewValidator
      ✓ happy path (568ms)
      ✓ deny adding already existed voting key
      ✓ deny adding already existed payout key (181ms)
      ✓ should create validator with all keys after finalization (1364ms)
      ✓ should allow removing new validator if finalizeChange did not happen (2178ms)
    #vote
      ✓ should let a validator to vote (151ms)
      ✓ reject vote should be accepted (175ms)
      ✓ should allow multiple voters to vote (753ms)
      ✓ should not let vote nonVoting key (44ms)
      ✓ should not let vote before startTime key (100ms)
      ✓ should not let vote after endTime key (108ms)
      ✓ should not let vote with already voted key (187ms)
      ✓ should not let vote with invalid choice (191ms)
      ✓ should not let vote with invalid id (184ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (894ms)
      ✓ finalize addition of payout key (957ms)
      ✓ finalize addition of VotingKey (1060ms)
      ✓ cannot create ballot for using previous mining key (2206ms)
      ✓ finalize addition of MiningKey (1138ms)
      ✓ finalize removal of MiningKey (1325ms)
      ✓ finalize removal of VotingKey (1335ms)
      ✓ finalize removal of PayoutKey (1152ms)
      ✓ finalize swap of VotingKey (1153ms)
      ✓ finalize swap of PayoutKey (1202ms)
      ✓ finalize swap of MiningKey (1447ms)
      ✓ prevent double finalize (1582ms)
      ✓ allowed at once after all validators gave their votes (1526ms)
    #migrate
      ✓ should copy a ballot to the new contract (1333ms)
  Contract: VotingToChangeMinThreshold [all features]
    #createBallot
      ✓ happy path (323ms)
      ✓ proposed value should be more than or equal to 3
      ✓ proposed value should not be equal to the same value (124ms)
      ✓ should not let create more ballots than the limit (9756ms)
    #vote
      ✓ should let a validator to vote (144ms)
      ✓ reject vote should be accepted (155ms)
      ✓ should allow multiple voters to vote (376ms)
      ✓ should not let vote nonVoting key (54ms)
      ✓ should not let vote before startTime key (112ms)
      ✓ should not let vote after endTime key (103ms)
      ✓ should not let vote with already voted key (205ms)
      ✓ should not let vote with invalid choice (170ms)
      ✓ should not let vote with invalid id (184ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (587ms)
      ✓ should change to proposedValue when quorum is reached (1374ms)
      ✓ prevents double finalize (1678ms)
      ✓ allowed at once after all validators gave their votes (1785ms)
    #migrate
      ✓ should copy a ballot to the new contract (1244ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (83ms)
      ✓ should change implementation address (113ms)
      ✓ should increment implementation version (107ms)
      ✓ new implementation should work (110ms)
      ✓ new implementation should use the same proxyStorage address (88ms)
      ✓ new implementation should use the same storage (544ms)
  Contract: VotingToChangeMinThreshold upgraded [all features]
    #createBallot
      ✓ happy path (336ms)
      ✓ proposed value should be more than or equal to 3
      ✓ proposed value should not be equal to the same value
      ✓ should not let create more ballots than the limit (9997ms)
    #vote
      ✓ should let a validator to vote (159ms)
      ✓ reject vote should be accepted (154ms)
      ✓ should allow multiple voters to vote (373ms)
      ✓ should not let vote nonVoting key (50ms)
      ✓ should not let vote before startTime key (96ms)
      ✓ should not let vote after endTime key (101ms)
      ✓ should not let vote with already voted key (195ms)
      ✓ should not let vote with invalid choice (175ms)
      ✓ should not let vote with invalid id (265ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (609ms)
      ✓ should change to proposedValue when quorum is reached (1206ms)
      ✓ prevents double finalize (1599ms)
      ✓ allowed at once after all validators gave their votes (1720ms)
    #migrate
      ✓ should copy a ballot to the new contract (1131ms)
  Contract: VotingToChangeProxyAddress [all features]
    #createBallot
      ✓ happy path (319ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (641ms)
      ✓ should not let create more ballots than the limit (9679ms)
    #vote
      ✓ should let a validator to vote (146ms)
      ✓ reject vote should be accepted (141ms)
      ✓ should allow multiple voters to vote (820ms)
      ✓ should not let vote nonVoting key (53ms)
      ✓ should not let vote before startTime key (176ms)
      ✓ should not let vote after endTime key (166ms)
      ✓ should not let vote with already voted key (216ms)
      ✓ should not let vote with invalid choice (297ms)
      ✓ should not let vote with invalid id (185ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (750ms)
      ✓ should change KeysManager implementation (943ms)
      ✓ should change VotingToChangeKeys implementation (1171ms)
      ✓ should change VotingToChangeMinThreshold implementation (1032ms)
      ✓ should change VotingToChangeProxy implementation (977ms)
      ✓ should change BallotsStorage implementation (1015ms)
      ✓ should change ValidatorMetadata implementation (997ms)
      ✓ should change ProxyStorage implementation (1048ms)
      ✓ prevents double finalize (1576ms)
      ✓ allowed at once after all validators gave their votes (1365ms)
    #migrate
      ✓ should copy a ballot to the new contract (1297ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (80ms)
      ✓ should change implementation address (111ms)
      ✓ should increment implementation version (123ms)
      ✓ new implementation should work (120ms)
      ✓ new implementation should use the same proxyStorage address (84ms)
      ✓ new implementation should use the same storage (592ms)
  Contract: VotingToChangeProxyAddress upgraded [all features]
    #createBallot
      ✓ happy path (340ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (491ms)
      ✓ should not let create more ballots than the limit (9687ms)
    #vote
      ✓ should let a validator to vote (142ms)
      ✓ reject vote should be accepted (154ms)
      ✓ should allow multiple voters to vote (743ms)
      ✓ should not let vote nonVoting key (43ms)
      ✓ should not let vote before startTime key (99ms)
      ✓ should not let vote after endTime key (105ms)
      ✓ should not let vote with already voted key (194ms)
      ✓ should not let vote with invalid choice (187ms)
      ✓ should not let vote with invalid id (178ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (758ms)
      ✓ should change KeysManager implementation (937ms)
      ✓ should change VotingToChangeKeys implementation (1019ms)
      ✓ should change VotingToChangeMinThreshold implementation (1079ms)
      ✓ should change VotingToChangeProxy implementation (1152ms)
      ✓ should change BallotsStorage implementation (1119ms)
      ✓ should change ValidatorMetadata implementation (1109ms)
      ✓ should change ProxyStorage implementation (1065ms)
      ✓ prevents double finalize (1818ms)
      ✓ allowed at once after all validators gave their votes (1462ms)
    #migrate
      ✓ should copy a ballot to the new contract (1251ms)
  Contract: VotingToManageEmissionFunds [all features]
    #init
      ✓ should change state correctly (106ms)
      ✓ cannot be called more than once
    #createBallot
      ✓ happy path (486ms)
      ✓ may be called only by valid voting key (140ms)
      ✓ endTime must be greater than startTime (52ms)
      ✓ startTime must be greater than current time (53ms)
      ✓ cannot be called before emission release time (69ms)
      ✓ ballot cannot last longer than distribution threshold (51ms)
      ✓ receiver address should not be 0x0 (69ms)
      ✓ cannot create multiple ballots during the same distribution period (411ms)
      ✓ should allow to create new ballot after the next emission release threshold (402ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (141ms)
      ✓ should update to the next threshold (78ms)
      ✓ should update to the future threshold (60ms)
    #vote
      ✓ should let a validator to vote (826ms)
      ✓ should allow multiple voters to vote (1408ms)
      ✓ should not let vote by nonvoting key (52ms)
      ✓ should not let vote before startTime (97ms)
      ✓ should not let vote after endTime (342ms)
      ✓ should not let vote with already voted key (194ms)
      ✓ should not let vote with invalid choice (173ms)
      ✓ should not let vote with invalid id (174ms)
      ✓ should not let vote if already finalized (1257ms)
      ✓ should not let vote with old miningKey (1995ms)
    #finalize
      ✓ happy path (377ms)
      ✓ freeze funds if it did not pass minimum voters count (966ms)
      ✓ freeze funds if there is no majority of 3 votes (1084ms)
      ✓ freeze funds if there is no majority of 4 votes (1557ms)
      ✓ send funds to receiver if most votes are for sending (2024ms)
      ✓ send funds to receiver if most votes are for sending (1538ms)
      ✓ burn funds if most votes are for burning (1544ms)
      ✓ prevents finalize with invalid id (130ms)
      ✓ do not let finalize if a ballot is active (61ms)
      ✓ finalize immediately if the last validator gave their vote (965ms)
      ✓ prevents double finalize (140ms)
      ✓ should refresh emission release time (144ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (90ms)
      ✓ should change implementation address (108ms)
      ✓ should increment implementation version (110ms)
      ✓ new implementation should work (121ms)
      ✓ new implementation should use the same proxyStorage address (92ms)
      ✓ new implementation should use the same storage (938ms)
  Contract: VotingToManageEmissionFunds upgraded [all features]
    #init
      ✓ should change state correctly (112ms)
      ✓ cannot be called more than once
    #createBallot
      ✓ happy path (503ms)
      ✓ may be called only by valid voting key (181ms)
      ✓ endTime must be greater than startTime (50ms)
      ✓ startTime must be greater than current time (54ms)
      ✓ cannot be called before emission release time (62ms)
      ✓ ballot cannot last longer than distribution threshold (59ms)
      ✓ receiver address should not be 0x0 (65ms)
      ✓ cannot create multiple ballots during the same distribution period (507ms)
      ✓ should allow to create new ballot after the next emission release threshold (417ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (133ms)
      ✓ should update to the next threshold (63ms)
      ✓ should update to the future threshold (63ms)
    #vote
      ✓ should let a validator to vote (844ms)
      ✓ should allow multiple voters to vote (1392ms)
      ✓ should not let vote by nonvoting key (46ms)
      ✓ should not let vote before startTime (90ms)
      ✓ should not let vote after endTime (336ms)
      ✓ should not let vote with already voted key (211ms)
      ✓ should not let vote with invalid choice (160ms)
      ✓ should not let vote with invalid id (171ms)
      ✓ should not let vote if already finalized (1339ms)
      ✓ should not let vote with old miningKey (2120ms)
    #finalize
      ✓ happy path (484ms)
      ✓ freeze funds if it did not pass minimum voters count (983ms)
      ✓ freeze funds if there is no majority of 3 votes (1102ms)
      ✓ freeze funds if there is no majority of 4 votes (1539ms)
      ✓ send funds to receiver if most votes are for sending (2003ms)
      ✓ send funds to receiver if most votes are for sending (1560ms)
      ✓ burn funds if most votes are for burning (1529ms)
      ✓ prevents finalize with invalid id (60ms)
      ✓ do not let finalize if a ballot is active (61ms)
      ✓ finalize immediately if the last validator gave their vote (897ms)
      ✓ prevents double finalize (147ms)
      ✓ should refresh emission release time (133ms)
  511 passing (13m)
 ```
