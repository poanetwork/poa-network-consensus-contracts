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

- `ProxyStorage_flat.sol` - Deploy `ProxyStorage` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - equal to zero,
`_implementationAddress` - address of ProxyStorage contract.
-  Make a call to `ProxyStorage init` with `_poaConsensus` parameter equal to the address of PoaNetworkConsensus contract, using the address of `EternalStorageProxy` and ABI of `ProxyStorage`.
-  Select `PoaNetworkConsensus` contract and call `setProxyStorage` with the address of ProxyStorage contract.
- `KeysManager_flat.sol` - Deploy `KeysManager` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of KeysManager contract.
-  Make a call to `KeysManager init` with `_previousKeysManager` parameter equal to 0x0000000000000000000000000000000000000000, using the address of `EternalStorageProxy` and ABI of `KeysManager`.
- `BallotsStorage_flat.sol` - Deploy `BallotsStorage` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of BallotsStorage contract.
-  Make a call to `BallotsStorage init` with `_thresholds` parameter equal to [3, 2], using the address of `EternalStorageProxy` and ABI of `BallotsStorage`.
- `VotingToChangeKeys_flat.sol` - Deploy `VotingToChangeKeys` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeKeys contract.
-  Make a call to `VotingToChangeKeys init` with `_minBallotDuration` parameter equal to `172800`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeKeys`.
-  Make a call to `VotingToChangeKeys migrateDisable`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeKeys`.
- `VotingToChangeMinThreshold_flat.sol` - Deploy `VotingToChangeMinThreshold` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeMinThreshold contract.
-  Make a call to `VotingToChangeMinThreshold init` with `_minBallotDuration` parameter equal to `172800` and `_minPossibleThreshold` parameter equal to `3`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeMinThreshold`.
-  Make a call to `VotingToChangeMinThreshold migrateDisable`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeMinThreshold`.
- `VotingToChangeProxyAddress_flat.sol` - Deploy `VotingToChangeProxyAddress` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToChangeProxyAddress contract.
-  Make a call to `VotingToChangeProxyAddress init` with `_minBallotDuration` parameter equal to `172800`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeProxyAddress`.
-  Make a call to `VotingToChangeProxyAddress migrateDisable`, using the address of `EternalStorageProxy` and ABI of `VotingToChangeProxyAddress`.
- `ValidatorMetadata_flat.sol` - Deploy `ValidatorMetadata` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of ValidatorMetadata contract.
- `VotingToManageEmissionFunds_flat.sol` - Deploy `VotingToManageEmissionFunds` contract.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of VotingToManageEmissionFunds contract.
- `EmissionFunds_flat.sol` - Deploy `EmissionFunds` contract with constructor parameter `_votingToManageEmissionFunds` equal to `EternalStorageProxy` address of `VotingToManageEmissionFunds` contract.
- `RewardByBlock_flat.sol` - Deploy `RewardByBlock` contract and replace `emissionFunds` constant value `0x00...` inside it with the address of deployed `EmissionFunds`. Then deploy `RewardByBlock`.
- `EternalStorageProxy_flat.sol` - Deploy `EternalStorageProxy` contract with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of RewardByBlock contract.
-  Make a call to `VotingToManageEmissionFunds init`, using the address of `EternalStorageProxy` and ABI of `VotingToManageEmissionFunds`, with the next parameters: <br />
`_emissionFunds` - address of EmissionFunds contract,
`_emissionReleaseTime` - your emission release unix timestamp,
`_emissionReleaseThreshold` - your emission release threshold in seconds,
`_distributionThreshold` - your distribution threshold in seconds.
-  Select deployed `ProxyStorage` contract and make a call from MoC address to `initializeAddresses` with relevant addresses.

## Unit tests
[Full Test Report](https://poanetwork.github.io/poa-network-consensus-contracts/mochawesome.html)<br />

```
  Contract: BallotsStorage [all features]
    #init
      ✓ prevent from double init (52ms)
      ✓ thresholds are correct (59ms)
    #migrate
      ✓ should copy thresholds from an old contract (476ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (104ms)
      ✓ cannot be set for Invalid threshold (207ms)
      ✓ new value cannot be equal to 0 (202ms)
      ✓ sets new value for Keys threshold (85ms)
      ✓ sets new value for MetadataChange threshold (94ms)
    #getProxyThreshold
      ✓ return value is correct (642ms)
      ✓ return value is correct if MoC is removed (2025ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (97ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (411ms)
      ✓ returns correct limit if MoC is removed (1797ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (207ms)
      ✓ should change implementation address (208ms)
      ✓ should increment implementation version (222ms)
      ✓ new implementation should work (244ms)
      ✓ new implementation should use the same proxyStorage address (183ms)
      ✓ new implementation should use the same storage (542ms)

  Contract: BallotsStorage upgraded [all features]
    #init
      ✓ prevent from double init (44ms)
      ✓ thresholds are correct (69ms)
    #migrate
      ✓ should copy thresholds from an old contract (555ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (97ms)
      ✓ cannot be set for Invalid threshold (243ms)
      ✓ new value cannot be equal to 0 (289ms)
      ✓ sets new value for Keys threshold (131ms)
      ✓ sets new value for MetadataChange threshold (82ms)
    #getProxyThreshold
      ✓ return value is correct (792ms)
      ✓ return value is correct if MoC is removed (2104ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (188ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (421ms)
      ✓ returns correct limit if MoC is removed (1733ms)

  Contract: EternalStorageProxy [all features]
    constructor
      ✓ should revert if implementation address is equal to 0x0
      ✓ should allow ProxyStorage address equal to 0x0 (82ms)
      ✓ should set ProxyStorage address (91ms)
      ✓ should set implementation address (81ms)
      ✓ should set owner (82ms)
    #renounceOwnership
      ✓ may only be called by an owner (63ms)
      ✓ should set owner to 0x0 (65ms)
    #transferOwnership
      ✓ may only be called by an owner (54ms)
      ✓ should change owner (59ms)
      ✓ should not change owner if its address is 0x0
    #upgradeTo
      ✓ may only be called by ProxyStorage (66ms)
      ✓ should not change implementation address if it is the same
      ✓ should not change implementation address if it is 0x0 (82ms)
      ✓ should change implementation address (66ms)
      ✓ should increment version (67ms)

  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (97ms)
      ✓ adds masterOfCeremony to validators hash (103ms)
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (118ms)
      ✓ cannot allow 0x0 addresses (90ms)
      ✓ should not allow to initialize already initialized key (132ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (269ms)
      ✓ should not equal to master of ceremony (62ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (1029ms)
      ✓ should increment initialKeyCount by 1 (118ms)
      ✓ should set initialKeys hash to activated status (231ms)
    #createKeys
      ✓ should only be called from initialized key (267ms)
      ✓ params should not be equal to 0x0 (521ms)
      ✓ params should not be equal to each other (271ms)
      ✓ any of params should not be equal to initialKey (183ms)
      ✓ should not allow passing the same key after it is already created (759ms)
      ✓ should assign mining, voting, payout keys to relative mappings (324ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (370ms)
      ✓ adds validator to poaConsensus contract (274ms)
      ✓ should set validatorKeys hash (322ms)
      ✓ should set validatorKeys hash (284ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (125ms)
      ✓ should only be called from votingToChangeKeys (200ms)
      ✓ should not let add more than maxLimit (72ms)
      ✓ should set validatorKeys hash (225ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (214ms)
      ✓ may only be called if params are not the same (271ms)
      ✓ should add VotingKey (310ms)
      ✓ should only be called if mining is active (300ms)
      ✓ swaps keys if voting already exists (491ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (206ms)
      ✓ may only be called if params are not the same (272ms)
      ✓ should add PayoutKey (284ms)
      ✓ should only be called if mining is active (344ms)
      ✓ swaps keys if voting already exists (496ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (356ms)
      ✓ should remove miningKey (692ms)
      ✓ removes validator from poaConsensus (634ms)
      ✓ removes MoC from poaConsensus (1905ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (534ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (519ms)
      ✓ should be successful only for active voting key (408ms)
      ✓ should remove votingKey (600ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (391ms)
      ✓ should be successful only for active payout key (406ms)
      ✓ should remove payoutKey (522ms)
    #swapMiningKey
      ✓ should swap mining key (739ms)
      ✓ should swap MoC (460ms)
      ✓ should keep voting and payout keys (1071ms)
    #swapVotingKey
      ✓ should swap voting key (435ms)
    #swapPayoutKey
      ✓ should swap payout key (500ms)
    #migrateInitialKey
      ✓ can copy initial keys (615ms)
    #migrateMiningKey
      ✓ copies validator keys (2011ms)
      ✓ throws when trying to copy invalid mining key (301ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (336ms)
      ✓ should change implementation address (413ms)
      ✓ should increment implementation version (318ms)
      ✓ new implementation should work (344ms)
      ✓ new implementation should use the same proxyStorage address (176ms)
      ✓ new implementation should use the same storage (781ms)

  Contract: KeysManager upgraded [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (233ms)
      ✓ adds masterOfCeremony to validators hash (85ms)
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (129ms)
      ✓ cannot allow 0x0 addresses (126ms)
      ✓ should not allow to initialize already initialized key (181ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (297ms)
      ✓ should not equal to master of ceremony (68ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (1054ms)
      ✓ should increment initialKeyCount by 1 (288ms)
      ✓ should set initialKeys hash to activated status (157ms)
    #createKeys
      ✓ should only be called from initialized key (352ms)
      ✓ params should not be equal to 0x0 (498ms)
      ✓ params should not be equal to each other (730ms)
      ✓ any of params should not be equal to initialKey (184ms)
      ✓ should not allow passing the same key after it is already created (826ms)
      ✓ should assign mining, voting, payout keys to relative mappings (360ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (366ms)
      ✓ adds validator to poaConsensus contract (263ms)
      ✓ should set validatorKeys hash (327ms)
      ✓ should set validatorKeys hash (266ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (124ms)
      ✓ should only be called from votingToChangeKeys (209ms)
      ✓ should not let add more than maxLimit (89ms)
      ✓ should set validatorKeys hash (289ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (195ms)
      ✓ may only be called if params are not the same (239ms)
      ✓ should add VotingKey (308ms)
      ✓ should only be called if mining is active (313ms)
      ✓ swaps keys if voting already exists (589ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (199ms)
      ✓ may only be called if params are not the same (258ms)
      ✓ should add PayoutKey (312ms)
      ✓ should only be called if mining is active (319ms)
      ✓ swaps keys if voting already exists (497ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (272ms)
      ✓ should remove miningKey (735ms)
      ✓ removes validator from poaConsensus (462ms)
      ✓ removes MoC from poaConsensus (1662ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (468ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (456ms)
      ✓ should be successful only for active voting key (400ms)
      ✓ should remove votingKey (633ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (345ms)
      ✓ should be successful only for active payout key (563ms)
      ✓ should remove payoutKey (533ms)
    #swapMiningKey
      ✓ should swap mining key (645ms)
      ✓ should swap MoC (607ms)
      ✓ should keep voting and payout keys (1358ms)
    #swapVotingKey
      ✓ should swap voting key (569ms)
    #swapPayoutKey
      ✓ should swap payout key (533ms)
    #migrateInitialKey
      ✓ can copy initial keys (605ms)
    #migrateMiningKey
      ✓ copies validator keys (2300ms)
      ✓ throws when trying to copy invalid mining key (294ms)

  Contract: EmissionFunds [all features]
    #sendFundsTo
      ✓ should fail if receiver address is not full (631ms)

  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (302ms)
      ✓ should not let create metadata if called by non-voting key (136ms)
      ✓ should not let create metadata if called second time (269ms)
    #initMetadata
      ✓ happy path (816ms)
    #getMiningByVotingKey
      ✓ happy path (80ms)
    #changeRequest
      ✓ happy path (325ms)
      ✓ should not let call if there is no metadata (59ms)
      ✓ resets confirmations when changeRequest recreated (1233ms)
    #cancelPendingChange
      ✓ happy path (918ms)
      ✓ should not let delete records for someone else miningKey (1084ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (513ms)
      ✓ should confirm changes (530ms)
      ✓ prevent from double voting (734ms)
    #finalize
      ✓ happy path (1317ms)
    #getMinThreshold
      ✓ returns default value (50ms)
    #setProxyAddress
      ✓ can request a new proxy address (679ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (150ms)
      ✓ should change implementation address (184ms)
      ✓ should increment implementation version (162ms)
      ✓ new implementation should work (287ms)
      ✓ new implementation should use the same proxyStorage address (128ms)
      ✓ new implementation should use the same storage (454ms)

  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (293ms)
      ✓ should not let create metadata if called by non-voting key (138ms)
      ✓ should not let create metadata if called second time (260ms)
    #initMetadata
      ✓ happy path (871ms)
    #getMiningByVotingKey
      ✓ happy path (83ms)
    #changeRequest
      ✓ happy path (311ms)
      ✓ should not let call if there is no metadata (57ms)
      ✓ resets confirmations when changeRequest recreated (911ms)
    #cancelPendingChange
      ✓ happy path (894ms)
      ✓ should not let delete records for someone else miningKey (905ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (544ms)
      ✓ should confirm changes (786ms)
      ✓ prevent from double voting (727ms)
    #finalize
      ✓ happy path (1383ms)
    #getMinThreshold
      ✓ returns default value (41ms)
    #setProxyAddress
      ✓ can request a new proxy address (1304ms)

  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (154ms)
    #finalizeChange
      ✓ should only be called by systemAddress (127ms)
      ✓ should set finalized to true (107ms)
      ✓ should set currentValidators to pendingList (114ms)
      ✓ set currentValidators to pendingList after addValidator call (469ms)
    #addValidator
      ✓ should be called only from keys manager (113ms)
      ✓ should not allow to add already existing validator (573ms)
      ✓ should not allow 0x0 addresses (92ms)
      ✓ should set validatorsState for new validator (187ms)
      ✓ should set finalized to false (199ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (118ms)
    #swapValidatorKey
      ✓ should swap validator key (509ms)
      ✓ should swap MoC (549ms)
    #removeValidator
      ✓ should remove validator (147ms)
      ✓ should remove MoC (330ms)
      ✓ should be called only from keys manager (188ms)
      ✓ should only be allowed to remove from existing set of validators (74ms)
      ✓ should decrease length of pendingList (447ms)
      ✓ should change validatorsState (170ms)
      ✓ should set finalized to false (164ms)
    #setProxyStorage
      ✓ can be called by any validator (92ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address (60ms)
      ✓ sets proxyStorage (80ms)
      ✓ sets isMasterOfCeremonyInitialized (75ms)
      ✓ emits MoCInitializedProxyStorage (73ms)
      ✓ #getKeysManager (170ms)
    #isValidator
      ✓ returns true for validator (38ms)
    #isValidatorFinalized
      ✓ returns true for finalized validator (2823ms)

  Contract: ProxyStorage upgraded [all features]
    #constructor
      ✓ sets MoC and Poa (53ms)
    #initializeAddresses
      ✓ sets all addresses (228ms)
      ✓ prevents Moc to call it more than once (222ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (156ms)
      ✓ cannot be set to 0x0 address (98ms)
      ✓ sets keysManager (209ms)
      ✓ sets votingToChangeKeys (519ms)
      ✓ sets votingToChangeMinThreshold (218ms)
      ✓ sets ballotsStorage (199ms)
      ✓ sets poaConsensus (153ms)
      ✓ sets validatorMetadata (273ms)
      ✓ changes proxyStorage (itself) implementation (390ms)

  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets MoC and Poa (52ms)
    #initializeAddresses
      ✓ sets all addresses (665ms)
      ✓ prevents Moc to call it more than once (165ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (235ms)
      ✓ cannot be set to 0x0 address (99ms)
      ✓ sets keysManager (237ms)
      ✓ sets votingToChangeKeys (251ms)
      ✓ sets votingToChangeMinThreshold (287ms)
      ✓ sets ballotsStorage (342ms)
      ✓ sets poaConsensus (132ms)
      ✓ sets validatorMetadata (275ms)
      ✓ changes proxyStorage (itself) implementation (247ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (itself) (235ms)
      ✓ should change implementation address (189ms)
      ✓ should increment implementation version (221ms)
      ✓ new implementation should work (215ms)
      ✓ new implementation should use the same storage (420ms)

  Contract: RewardByBlock [all features]
    #reward
      ✓ may be called only by system address (164ms)
      ✓ should revert if input array contains more than one item (60ms)
      ✓ should revert if lengths of input arrays are not equal (108ms)
      ✓ should revert if `kind` parameter is not 0 (61ms)
      ✓ should revert if mining key does not exist (365ms)
      ✓ should assign rewards to payout key and EmissionFunds (131ms)
      ✓ should assign reward to mining key if payout key is 0 (228ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (218ms)
      ✓ should change implementation address (190ms)
      ✓ should increment implementation version (208ms)
      ✓ new implementation should work (219ms)
      ✓ new implementation should use the same proxyStorage address (174ms)

  Contract: RewardByBlock upgraded [all features]
    #reward
      ✓ may be called only by system address (152ms)
      ✓ should revert if input array contains more than one item (56ms)
      ✓ should revert if lengths of input arrays are not equal (190ms)
      ✓ should revert if `kind` parameter is not 0 (62ms)
      ✓ should revert if mining key does not exist (374ms)
      ✓ should assign rewards to payout key and EmissionFunds (139ms)
      ✓ should assign reward to mining key if payout key is 0 (280ms)

  Contract: RewardByTime [all features]
    #reward
      ✓ may be called only by system address (254ms)
      ✓ should assign rewards to payout keys and EmissionFunds (6983ms)
      ✓ should work fine after some validators are removed and added (2356ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (184ms)
      ✓ should change implementation address (294ms)
      ✓ should increment implementation version (192ms)
      ✓ new implementation should work (216ms)
      ✓ new implementation should use the same proxyStorage address (282ms)

  Contract: RewardByTime [all features]
    #reward
      ✓ may be called only by system address (246ms)
      ✓ should assign rewards to payout keys and EmissionFunds (6084ms)
      ✓ should work fine after some validators are removed and added (2473ms)

  Contract: Voting to change keys [all features]
    #createBallot
      ✓ happy path (1037ms)
      ✓ should not let create voting with invalid duration (279ms)
      ✓ should not let add votingKey for MoC (813ms)
      ✓ should not let create more ballots than the limit (18981ms)
    #createBallotToAddNewValidator
      ✓ happy path (877ms)
      ✓ deny adding already existed voting key (290ms)
      ✓ deny adding already existed payout key (475ms)
      ✓ should create validator with all keys after finalization (2553ms)
      ✓ should allow removing new validator if finalizeChange did not happen (4737ms)
    #vote
      ✓ should let a validator to vote (527ms)
      ✓ reject vote should be accepted (313ms)
      ✓ should allow multiple voters to vote (1406ms)
      ✓ should not let vote nonVoting key (101ms)
      ✓ should not let vote before startTime key (204ms)
      ✓ should not let vote after endTime key (190ms)
      ✓ should not let vote with already voted key (360ms)
      ✓ should not let vote with invalid choice (335ms)
      ✓ should not let vote with invalid id (339ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (1545ms)
      ✓ finalize addition of payout key (2110ms)
      ✓ finalize addition of VotingKey (2366ms)
      ✓ cannot create ballot for using previous mining key (4106ms)
      ✓ finalize addition of MiningKey (2448ms)
      ✓ finalize removal of MiningKey (2840ms)
      ✓ finalize removal of VotingKey (2211ms)
      ✓ finalize removal of PayoutKey (2224ms)
      ✓ finalize swap of VotingKey (2262ms)
      ✓ finalize swap of PayoutKey (2372ms)
      ✓ finalize swap of MiningKey (2513ms)
      ✓ prevent double finalize (2923ms)
      ✓ allowed at once after all validators gave their votes (2719ms)
    #migrate
      ✓ should copy a ballot to the new contract (2445ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (127ms)
      ✓ should change implementation address (228ms)
      ✓ should increment implementation version (215ms)
      ✓ new implementation should work (180ms)
      ✓ new implementation should use the same proxyStorage address (388ms)
      ✓ new implementation should use the same storage (1924ms)

  Contract: Voting to change keys upgraded [all features]
    #createBallot
      ✓ happy path (1179ms)
      ✓ should not let create voting with invalid duration (400ms)
      ✓ should not let add votingKey for MoC (877ms)
      ✓ should not let create more ballots than the limit (18478ms)
    #createBallotToAddNewValidator
      ✓ happy path (786ms)
      ✓ deny adding already existed voting key (230ms)
      ✓ deny adding already existed payout key (387ms)
      ✓ should create validator with all keys after finalization (4221ms)
      ✓ should allow removing new validator if finalizeChange did not happen (4094ms)
    #vote
      ✓ should let a validator to vote (364ms)
      ✓ reject vote should be accepted (296ms)
      ✓ should allow multiple voters to vote (1810ms)
      ✓ should not let vote nonVoting key (146ms)
      ✓ should not let vote before startTime key (185ms)
      ✓ should not let vote after endTime key (192ms)
      ✓ should not let vote with already voted key (405ms)
      ✓ should not let vote with invalid choice (415ms)
      ✓ should not let vote with invalid id (651ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (1758ms)
      ✓ finalize addition of payout key (3044ms)
      ✓ finalize addition of VotingKey (2143ms)
      ✓ cannot create ballot for using previous mining key (4507ms)
      ✓ finalize addition of MiningKey (2092ms)
      ✓ finalize removal of MiningKey (2436ms)
      ✓ finalize removal of VotingKey (2141ms)
      ✓ finalize removal of PayoutKey (2239ms)
      ✓ finalize swap of VotingKey (2253ms)
      ✓ finalize swap of PayoutKey (2454ms)
      ✓ finalize swap of MiningKey (2648ms)
      ✓ prevent double finalize (3134ms)
      ✓ allowed at once after all validators gave their votes (2728ms)
    #migrate
      ✓ should copy a ballot to the new contract (3519ms)

  Contract: VotingToChangeMinThreshold [all features]
    #createBallot
      ✓ happy path (712ms)
      ✓ proposed value should be more than or equal to 3 (48ms)
      ✓ proposed value should not be equal to the same value (57ms)
      ✓ should not let create more ballots than the limit (19659ms)
    #vote
      ✓ should let a validator to vote (273ms)
      ✓ reject vote should be accepted (293ms)
      ✓ should allow multiple voters to vote (888ms)
      ✓ should not let vote nonVoting key (89ms)
      ✓ should not let vote before startTime key (181ms)
      ✓ should not let vote after endTime key (186ms)
      ✓ should not let vote with already voted key (466ms)
      ✓ should not let vote with invalid choice (430ms)
      ✓ should not let vote with invalid id (349ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (1128ms)
      ✓ should change to proposedValue when quorum is reached (2278ms)
      ✓ prevents double finalize (2849ms)
      ✓ allowed at once after all validators gave their votes (3140ms)
    #migrate
      ✓ should copy a ballot to the new contract (2240ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (114ms)
      ✓ should change implementation address (160ms)
      ✓ should increment implementation version (176ms)
      ✓ new implementation should work (182ms)
      ✓ new implementation should use the same proxyStorage address (147ms)
      ✓ new implementation should use the same storage (749ms)

  Contract: VotingToChangeMinThreshold upgraded [all features]
    #createBallot
      ✓ happy path (570ms)
      ✓ proposed value should be more than or equal to 3 (42ms)
      ✓ proposed value should not be equal to the same value (60ms)
      ✓ should not let create more ballots than the limit (17983ms)
    #vote
      ✓ should let a validator to vote (261ms)
      ✓ reject vote should be accepted (270ms)
      ✓ should allow multiple voters to vote (704ms)
      ✓ should not let vote nonVoting key (108ms)
      ✓ should not let vote before startTime key (180ms)
      ✓ should not let vote after endTime key (190ms)
      ✓ should not let vote with already voted key (361ms)
      ✓ should not let vote with invalid choice (334ms)
      ✓ should not let vote with invalid id (376ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (1109ms)
      ✓ should change to proposedValue when quorum is reached (2278ms)
      ✓ prevents double finalize (3814ms)
      ✓ allowed at once after all validators gave their votes (3899ms)
    #migrate
      ✓ should copy a ballot to the new contract (1913ms)

  Contract: VotingToChangeProxyAddress [all features]
    #createBallot
      ✓ happy path (701ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (831ms)
      ✓ should not let create more ballots than the limit (19697ms)
    #vote
      ✓ should let a validator to vote (274ms)
      ✓ reject vote should be accepted (284ms)
      ✓ should allow multiple voters to vote (1473ms)
      ✓ should not let vote nonVoting key (102ms)
      ✓ should not let vote before startTime key (188ms)
      ✓ should not let vote after endTime key (278ms)
      ✓ should not let vote with already voted key (387ms)
      ✓ should not let vote with invalid choice (350ms)
      ✓ should not let vote with invalid id (341ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (2574ms)
      ✓ should change KeysManager implementation (1836ms)
      ✓ should change VotingToChangeKeys implementation (1965ms)
      ✓ should change VotingToChangeMinThreshold implementation (1895ms)
      ✓ should change VotingToChangeProxy implementation (1920ms)
      ✓ should change BallotsStorage implementation (2059ms)
      ✓ should change ValidatorMetadata implementation (2158ms)
      ✓ should change ProxyStorage implementation (1761ms)
      ✓ prevents double finalize (2694ms)
      ✓ allowed at once after all validators gave their votes (2575ms)
    #migrate
      ✓ should copy a ballot to the new contract (2211ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (117ms)
      ✓ should change implementation address (161ms)
      ✓ should increment implementation version (471ms)
      ✓ new implementation should work (193ms)
      ✓ new implementation should use the same proxyStorage address (436ms)
      ✓ new implementation should use the same storage (1408ms)

  Contract: VotingToChangeProxyAddress upgraded [all features]
    #createBallot
      ✓ happy path (638ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (1923ms)
      ✓ should not let create more ballots than the limit (19183ms)
    #vote
      ✓ should let a validator to vote (274ms)
      ✓ reject vote should be accepted (299ms)
      ✓ should allow multiple voters to vote (1505ms)
      ✓ should not let vote nonVoting key (91ms)
      ✓ should not let vote before startTime key (195ms)
      ✓ should not let vote after endTime key (187ms)
      ✓ should not let vote with already voted key (374ms)
      ✓ should not let vote with invalid choice (369ms)
      ✓ should not let vote with invalid id (335ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (1350ms)
      ✓ should change KeysManager implementation (1731ms)
      ✓ should change VotingToChangeKeys implementation (2403ms)
      ✓ should change VotingToChangeMinThreshold implementation (2033ms)
      ✓ should change VotingToChangeProxy implementation (1988ms)
      ✓ should change BallotsStorage implementation (1899ms)
      ✓ should change ValidatorMetadata implementation (2157ms)
      ✓ should change ProxyStorage implementation (1837ms)
      ✓ prevents double finalize (2942ms)
      ✓ allowed at once after all validators gave their votes (2347ms)
    #migrate
      ✓ should copy a ballot to the new contract (3216ms)

  Contract: VotingToManageEmissionFunds [all features]
    #init
      ✓ should change state correctly (217ms)
      ✓ cannot be called more than once
    #createBallot
      ✓ happy path (707ms)
      ✓ may be called only by valid voting key (308ms)
      ✓ endTime must be greater than startTime (86ms)
      ✓ startTime must be greater than current time (87ms)
      ✓ cannot be called before emission release time (125ms)
      ✓ ballot cannot last longer than distribution threshold (95ms)
      ✓ receiver address should not be 0x0 (117ms)
      ✓ cannot create multiple ballots during the same distribution period (755ms)
      ✓ should allow to create new ballot after the next emission release threshold (762ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (188ms)
      ✓ should update to the next threshold (123ms)
      ✓ should update to the future threshold (123ms)
    #vote
      ✓ should let a validator to vote (1161ms)
      ✓ should allow multiple voters to vote (2229ms)
      ✓ should not let vote by nonvoting key (92ms)
      ✓ should not let vote before startTime (165ms)
      ✓ should not let vote after endTime (490ms)
      ✓ should not let vote with already voted key (357ms)
      ✓ should not let vote with invalid choice (348ms)
      ✓ should not let vote with invalid id (327ms)
      ✓ should not let vote if already finalized (2502ms)
      ✓ should not let vote with old miningKey (3729ms)
    #finalize
      ✓ happy path (761ms)
      ✓ freeze funds if it did not pass minimum voters count (1927ms)
      ✓ freeze funds if there is no majority of 3 votes (1879ms)
      ✓ freeze funds if there is no majority of 4 votes (2746ms)
      ✓ send funds to receiver if most votes are for sending (3135ms)
      ✓ send funds to receiver if most votes are for sending (2378ms)
      ✓ burn funds if most votes are for burning (2400ms)
      ✓ prevents finalize with invalid id (95ms)
      ✓ do not let finalize if a ballot is active (123ms)
      ✓ finalize immediately if the last validator gave their vote (1740ms)
      ✓ prevents double finalize (657ms)
      ✓ should refresh emission release time (455ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (132ms)
      ✓ should change implementation address (179ms)
      ✓ should increment implementation version (293ms)
      ✓ new implementation should work (218ms)
      ✓ new implementation should use the same proxyStorage address (165ms)
      ✓ new implementation should use the same storage (2829ms)

  Contract: VotingToManageEmissionFunds upgraded [all features]
    #init
      ✓ should change state correctly (193ms)
      ✓ cannot be called more than once (43ms)
    #createBallot
      ✓ happy path (782ms)
      ✓ may be called only by valid voting key (394ms)
      ✓ endTime must be greater than startTime (86ms)
      ✓ startTime must be greater than current time (102ms)
      ✓ cannot be called before emission release time (197ms)
      ✓ ballot cannot last longer than distribution threshold (102ms)
      ✓ receiver address should not be 0x0 (128ms)
      ✓ cannot create multiple ballots during the same distribution period (781ms)
      ✓ should allow to create new ballot after the next emission release threshold (859ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (176ms)
      ✓ should update to the next threshold (353ms)
      ✓ should update to the future threshold (387ms)
    #vote
      ✓ should let a validator to vote (1146ms)
      ✓ should allow multiple voters to vote (2572ms)
      ✓ should not let vote by nonvoting key (102ms)
      ✓ should not let vote before startTime (180ms)
      ✓ should not let vote after endTime (622ms)
      ✓ should not let vote with already voted key (511ms)
      ✓ should not let vote with invalid choice (306ms)
      ✓ should not let vote with invalid id (397ms)
      ✓ should not let vote if already finalized (2415ms)
      ✓ should not let vote with old miningKey (3855ms)
    #finalize
      ✓ happy path (820ms)
      ✓ freeze funds if it did not pass minimum voters count (1664ms)
      ✓ freeze funds if there is no majority of 3 votes (2046ms)
      ✓ freeze funds if there is no majority of 4 votes (2462ms)
      ✓ send funds to receiver if most votes are for sending (2962ms)
      ✓ send funds to receiver if most votes are for sending (2229ms)
      ✓ burn funds if most votes are for burning (2275ms)
      ✓ prevents finalize with invalid id (104ms)
      ✓ do not let finalize if a ballot is active (117ms)
      ✓ finalize immediately if the last validator gave their vote (1839ms)
      ✓ prevents double finalize (270ms)
      ✓ should refresh emission release time (250ms)
  534 passing (26m)
 ```
