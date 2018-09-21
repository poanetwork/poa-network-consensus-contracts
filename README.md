# poa-network-consensus-contracts

[![Build Status](https://travis-ci.org/poanetwork/poa-network-consensus-contracts.svg?branch=master)](https://travis-ci.org/poanetwork/poa-network-consensus-contracts)

## Security Audit
- [PoA Consensus Audit.pdf](https://github.com/poanetwork/poa-network-consensus-contracts/blob/a9f63b19e5e4f0f238211d0cd8c456ad384d4a6c/audit/MixBytes/PoA%20Consensus%20Audit.pdf) by MixBytes

### Start POA network

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
      ✓ prevent from double init
      ✓ thresholds are correct (40ms)
    #migrate
      ✓ should copy thresholds from an old contract (282ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (66ms)
      ✓ cannot be set for Invalid threshold (200ms)
      ✓ new value cannot be equal to 0 (124ms)
      ✓ sets new value for Keys threshold (57ms)
      ✓ sets new value for MetadataChange threshold (71ms)
    #getProxyThreshold
      ✓ return value is correct (392ms)
      ✓ return value is correct if MoC is removed (1286ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (71ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (253ms)
      ✓ returns correct limit if MoC is removed (1044ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (131ms)
      ✓ should change implementation address (145ms)
      ✓ should increment implementation version (125ms)
      ✓ new implementation should work (156ms)
      ✓ new implementation should use the same proxyStorage address (121ms)
      ✓ new implementation should use the same storage (157ms)
  Contract: BallotsStorage upgraded [all features]
    #init
      ✓ prevent from double init
      ✓ thresholds are correct
    #migrate
      ✓ should copy thresholds from an old contract (222ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (58ms)
      ✓ cannot be set for Invalid threshold (181ms)
      ✓ new value cannot be equal to 0 (138ms)
      ✓ sets new value for Keys threshold (53ms)
      ✓ sets new value for MetadataChange threshold (66ms)
    #getProxyThreshold
      ✓ return value is correct (370ms)
      ✓ return value is correct if MoC is removed (1220ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (51ms)
    #getBallotLimitPerValidator
      ✓ returns correct limit (243ms)
      ✓ returns correct limit if MoC is removed (1079ms)
  Contract: EmissionFunds [all features]
    constructor
      ✓ should save VotingToManageEmissionFunds address
    #fallback
      ✓ should receive funds (327ms)
    #sendFundsTo
      ✓ may only be called by VotingToManageEmissionFunds (39ms)
      ✓ should send funds to receiver (332ms)
      ✓ should send entire amount (339ms)
      ✓ should not send funds if amount greater than balance (319ms)
      ✓ should not send funds if amount is too much (312ms)
      ✓ should be fulfilled if receiver is 0x0 (168ms)
      ✓ should be fulfilled if amount is zero (328ms)
      ✓ should fail if receiver address is not full (664ms)
    #burnFunds
      ✓ may only be called by VotingToManageEmissionFunds
      ✓ should burn funds (163ms)
      ✓ should burn entire amount (165ms)
      ✓ should not burn funds if amount greater than balance (165ms)
      ✓ should not burn funds if amount is too much (263ms)
      ✓ should be fulfilled if amount is zero (159ms)
    #freezeFunds
      ✓ may only be called by VotingToManageEmissionFunds (45ms)
      ✓ should freeze funds (168ms)
      ✓ should be fulfilled if amount is zero (159ms)
  Contract: EternalStorageProxy [all features]
    constructor
      ✓ should revert if implementation address is equal to 0x0
      ✓ should allow ProxyStorage address equal to 0x0 (53ms)
      ✓ should set ProxyStorage address (52ms)
      ✓ should set implementation address (61ms)
      ✓ should set owner (42ms)
    #renounceOwnership
      ✓ may only be called by an owner
      ✓ should set owner to 0x0
    #transferOwnership
      ✓ may only be called by an owner (129ms)
      ✓ should change owner
      ✓ should not change owner if its address is 0x0
    #upgradeTo
      ✓ may only be called by ProxyStorage (41ms)
      ✓ should not change implementation address if it is the same
      ✓ should not change implementation address if it is 0x0
      ✓ should change implementation address
      ✓ should increment version (53ms)
  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (133ms)
      ✓ adds masterOfCeremony to validators hash
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (104ms)
      ✓ cannot allow 0x0 addresses (57ms)
      ✓ should not allow to initialize already initialized key (74ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (172ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (595ms)
      ✓ should increment initialKeyCount by 1 (80ms)
      ✓ should set initialKeys hash to activated status (103ms)
    #createKeys
      ✓ should only be called from initialized key (162ms)
      ✓ params should not be equal to 0x0 (209ms)
      ✓ params should not be equal to each other (138ms)
      ✓ any of params should not be equal to initialKey (231ms)
      ✓ should not allow passing the same key after it is already created (355ms)
      ✓ should assign mining, voting, payout keys to relative mappings (184ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (156ms)
      ✓ adds validator to poaConsensus contract (156ms)
      ✓ should set validatorKeys hash (149ms)
      ✓ should set validatorKeys hash (148ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (85ms)
      ✓ should only be called from votingToChangeKeys (111ms)
      ✓ should not let add more than maxLimit (64ms)
      ✓ should set validatorKeys hash (92ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (125ms)
      ✓ may only be called if params are not the same (150ms)
      ✓ should add VotingKey (165ms)
      ✓ should only be called if mining is active (239ms)
      ✓ swaps keys if voting already exists (236ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (132ms)
      ✓ may only be called if params are not the same (147ms)
      ✓ should add PayoutKey (175ms)
      ✓ should only be called if mining is active (321ms)
      ✓ swaps keys if voting already exists (252ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (183ms)
      ✓ should remove miningKey (667ms)
      ✓ removes validator from poaConsensus (331ms)
      ✓ removes MoC from poaConsensus (1040ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (299ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (208ms)
      ✓ should be successful only for active voting key (245ms)
      ✓ should remove votingKey (283ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (215ms)
      ✓ should be successful only for active payout key (257ms)
      ✓ should remove payoutKey (274ms)
    #swapMiningKey
      ✓ should swap mining key (702ms)
      ✓ should swap MoC (352ms)
      ✓ should keep voting and payout keys (531ms)
    #swapVotingKey
      ✓ should swap voting key (221ms)
    #swapPayoutKey
      ✓ should swap payout key (256ms)
    #migrateInitialKey
      ✓ can copy initial keys (390ms)
    #migrateMiningKey
      ✓ copies validator keys (1208ms)
      ✓ throws when trying to copy invalid mining key (208ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (99ms)
      ✓ should change implementation address (174ms)
      ✓ should increment implementation version (89ms)
      ✓ new implementation should work (123ms)
      ✓ new implementation should use the same proxyStorage address (186ms)
      ✓ new implementation should use the same storage (324ms)
  Contract: KeysManager upgraded [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (169ms)
      ✓ adds masterOfCeremony to validators hash
      ✓ cannot be called twice
    #initiateKeys
      ✓ can only be called by master of ceremony (81ms)
      ✓ cannot allow 0x0 addresses (64ms)
      ✓ should not allow to initialize already initialized key (87ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (185ms)
      ✓ should not equal to master of ceremony (44ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (674ms)
      ✓ should increment initialKeyCount by 1 (82ms)
      ✓ should set initialKeys hash to activated status (100ms)
    #createKeys
      ✓ should only be called from initialized key (182ms)
      ✓ params should not be equal to 0x0 (246ms)
      ✓ params should not be equal to each other (149ms)
      ✓ any of params should not be equal to initialKey (152ms)
      ✓ should not allow passing the same key after it is already created (380ms)
      ✓ should assign mining, voting, payout keys to relative mappings (171ms)
      ✓ should assign voting <-> mining key and payout <-> mining key relationships (187ms)
      ✓ adds validator to poaConsensus contract (154ms)
      ✓ should set validatorKeys hash (165ms)
      ✓ should set validatorKeys hash (247ms)
    #addMiningKey
      ✓ may only be called if KeysManager.init had been called before (88ms)
      ✓ should only be called from votingToChangeKeys (122ms)
      ✓ should not let add more than maxLimit (50ms)
      ✓ should set validatorKeys hash (108ms)
    #addVotingKey
      ✓ may only be called if KeysManager.init had been called before (117ms)
      ✓ may only be called if params are not the same (156ms)
      ✓ should add VotingKey (179ms)
      ✓ should only be called if mining is active (239ms)
      ✓ swaps keys if voting already exists (238ms)
    #addPayoutKey
      ✓ may only be called if KeysManager.init had been called before (145ms)
      ✓ may only be called if params are not the same (143ms)
      ✓ should add PayoutKey (169ms)
      ✓ should only be called if mining is active (344ms)
      ✓ swaps keys if voting already exists (251ms)
    #removeMiningKey
      ✓ may only be called if KeysManager.init had been called before (181ms)
      ✓ should remove miningKey (707ms)
      ✓ removes validator from poaConsensus (348ms)
      ✓ removes MoC from poaConsensus (1048ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key did not exist (308ms)
    #removeVotingKey
      ✓ may only be called if KeysManager.init had been called before (216ms)
      ✓ should be successful only for active voting key (229ms)
      ✓ should remove votingKey (377ms)
    #removePayoutKey
      ✓ may only be called if KeysManager.init had been called before (206ms)
      ✓ should be successful only for active payout key (231ms)
      ✓ should remove payoutKey (260ms)
    #swapMiningKey
      ✓ should swap mining key (737ms)
      ✓ should swap MoC (384ms)
      ✓ should keep voting and payout keys (523ms)
    #swapVotingKey
      ✓ should swap voting key (230ms)
    #swapPayoutKey
      ✓ should swap payout key (283ms)
    #migrateInitialKey
      ✓ can copy initial keys (445ms)
    #migrateMiningKey
      ✓ copies validator keys (1228ms)
      ✓ throws when trying to copy invalid mining key (205ms)
  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (170ms)
      ✓ should not let create metadata if fullAddress is too long (200ms)
      ✓ should not let create metadata if called by non-voting key (86ms)
      ✓ should not let create metadata if called second time (153ms)
    #clearMetadata
      ✓ happy path (770ms)
    #moveMetadata
      ✓ happy path (1142ms)
    #initMetadata
      ✓ happy path (441ms)
    #changeRequest
      ✓ happy path (248ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (515ms)
    #cancelPendingChange
      ✓ happy path (473ms)
      ✓ should not let delete records for someone else miningKey (490ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (236ms)
      ✓ should confirm changes (316ms)
      ✓ prevent from double voting (337ms)
      ✓ should not exceed confirmations limit (577ms)
    #finalize
      ✓ happy path (758ms)
    #getMinThreshold
      ✓ returns default value
    #upgradeTo
      ✓ may only be called by ProxyStorage (82ms)
      ✓ should change implementation address (79ms)
      ✓ should increment implementation version (80ms)
      ✓ new implementation should work (120ms)
      ✓ new implementation should use the same proxyStorage address (80ms)
      ✓ new implementation should use the same storage (321ms)
  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (169ms)
      ✓ should not let create metadata if fullAddress is too long (210ms)
      ✓ should not let create metadata if called by non-voting key (88ms)
      ✓ should not let create metadata if called second time (145ms)
    #clearMetadata
      ✓ happy path (677ms)
    #moveMetadata
      ✓ happy path (1014ms)
    #initMetadata
      ✓ happy path (553ms)
    #changeRequest
      ✓ happy path (165ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (495ms)
    #cancelPendingChange
      ✓ happy path (586ms)
      ✓ should not let delete records for someone else miningKey (490ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (415ms)
      ✓ should confirm changes (310ms)
      ✓ prevent from double voting (383ms)
      ✓ should not exceed confirmations limit (608ms)
    #finalize
      ✓ happy path (760ms)
    #getMinThreshold
      ✓ returns default value
  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (87ms)
      ✓ validators in the list must differ (129ms)
    #finalizeChange
      ✓ should only be called by systemAddress (79ms)
      ✓ should set finalized to true (73ms)
      ✓ should set currentValidators to pendingList (78ms)
      ✓ set currentValidators to pendingList after addValidator call (301ms)
    #addValidator
      ✓ should only be called from keys manager (63ms)
      ✓ should not allow to add already existing validator (78ms)
      ✓ should not allow 0x0 addresses (74ms)
      ✓ should set validatorsState for new validator (80ms)
      ✓ should set finalized to false (72ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (284ms)
    #swapValidatorKey
      ✓ should swap validator key (294ms)
      ✓ should swap MoC (271ms)
    #removeValidator
      ✓ should remove validator (95ms)
      ✓ should remove MoC (249ms)
      ✓ should only be called from keys manager (112ms)
      ✓ should only be allowed to remove from existing set of validators (46ms)
      ✓ should decrease length of pendingList (258ms)
      ✓ should change validatorsState (100ms)
      ✓ should set finalized to false (114ms)
    #setProxyStorage
      ✓ can be called by MoC (62ms)
      ✓ can be called by owner (67ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address
      ✓ sets proxyStorage (51ms)
      ✓ sets wasProxyStorageSet (47ms)
      ✓ emits MoCInitializedProxyStorage (38ms)
      ✓ #getKeysManager (58ms)
    #isValidator
      ✓ returns true for validator
    #isValidatorFinalized
      ✓ returns true for finalized validator (1654ms)
  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets PoA
    #initializeAddresses
      ✓ sets all addresses (158ms)
      ✓ prevents Moc to call it more than once (89ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (93ms)
      ✓ cannot be set to 0x0 address (69ms)
      ✓ sets keysManager (142ms)
      ✓ sets votingToChangeKeys (154ms)
      ✓ sets votingToChangeMinThreshold (253ms)
      ✓ sets ballotsStorage (142ms)
      ✓ sets poaConsensus (81ms)
      ✓ sets validatorMetadata (227ms)
      ✓ changes proxyStorage (itself) implementation (205ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (itself) (119ms)
      ✓ should change implementation address (115ms)
      ✓ should increment implementation version (127ms)
      ✓ new implementation should work (168ms)
      ✓ new implementation should use the same storage (182ms)
  Contract: ProxyStorage upgraded [all features]
    #constructor
      ✓ sets PoA
    #initializeAddresses
      ✓ sets all addresses (165ms)
      ✓ prevents Moc to call it more than once (81ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (180ms)
      ✓ cannot be set to 0x0 address (67ms)
      ✓ sets keysManager (158ms)
      ✓ sets votingToChangeKeys (163ms)
      ✓ sets votingToChangeMinThreshold (144ms)
      ✓ sets ballotsStorage (253ms)
      ✓ sets poaConsensus (81ms)
      ✓ sets validatorMetadata (172ms)
      ✓ changes proxyStorage (itself) implementation (145ms)
  Contract: RewardByBlock [all features]
    #reward
      ✓ may only be called by system address (94ms)
      ✓ should revert if input array contains more than one item
      ✓ should revert if lengths of input arrays are not equal (38ms)
      ✓ should revert if `kind` parameter is not 0
      ✓ should revert if mining key does not exist (252ms)
      ✓ should assign rewards to payout key and EmissionFunds (88ms)
      ✓ should assign reward to mining key if payout key is 0 (143ms)
      ✓ should assign rewards to extra receivers and clear extra receivers list (369ms)
    #addExtraReceiver
      ✓ may only be called by bridge contract (59ms)
      ✓ should revert if receiver address is 0x0
      ✓ should revert if amount is 0 (39ms)
      ✓ can only be called once for the same recipient (79ms)
      ✓ should add receivers (214ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (111ms)
      ✓ should change implementation address (111ms)
      ✓ should increment implementation version (116ms)
      ✓ new implementation should work (154ms)
      ✓ new implementation should use the same proxyStorage address (112ms)
  Contract: RewardByBlock upgraded [all features]
    #reward
      ✓ may only be called by system address (89ms)
      ✓ should revert if input array contains more than one item
      ✓ should revert if lengths of input arrays are not equal (46ms)
      ✓ should revert if `kind` parameter is not 0 (48ms)
      ✓ should revert if mining key does not exist (246ms)
      ✓ should assign rewards to payout key and EmissionFunds (81ms)
      ✓ should assign reward to mining key if payout key is 0 (121ms)
      ✓ should assign rewards to extra receivers and clear extra receivers list (421ms)
    #addExtraReceiver
      ✓ may only be called by bridge contract (68ms)
      ✓ should revert if receiver address is 0x0 (45ms)
      ✓ should revert if amount is 0 (47ms)
      ✓ can only be called once for the same recipient (72ms)
      ✓ should add receivers (199ms)
  Contract: RewardByTime [all features]
    #reward
      ✓ may only be called by system address (152ms)
      ✓ should assign rewards to payout keys and EmissionFunds (3292ms)
      ✓ should work fine after some validators are removed and added (1355ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (108ms)
      ✓ should change implementation address (111ms)
      ✓ should increment implementation version (112ms)
      ✓ new implementation should work (259ms)
      ✓ new implementation should use the same proxyStorage address (113ms)
  Contract: RewardByTime upgraded [all features]
    #reward
      ✓ may only be called by system address (150ms)
      ✓ should assign rewards to payout keys and EmissionFunds (3160ms)
      ✓ should work fine after some validators are removed and added (1459ms)
  Contract: Voting to change keys [all features]
    #createBallot
      ✓ happy path (705ms)
      ✓ should not let create voting with invalid duration (170ms)
      ✓ should not let add votingKey for MoC (416ms)
      ✓ should not let add votingKey for 0x0 (447ms)
      ✓ should not let add payoutKey for 0x0 (588ms)
      ✓ should not let create more ballots than the limit (10140ms)
    #createBallotToAddNewValidator
      ✓ happy path (296ms)
      ✓ deny adding already existed voting key
      ✓ deny adding already existed payout key (199ms)
      ✓ should create validator with all keys after finalization (1282ms)
      ✓ should allow removing new validator if finalizeChange did not happen (2249ms)
    #vote
      ✓ should let a validator to vote (194ms)
      ✓ reject vote should be accepted (199ms)
      ✓ should allow multiple voters to vote (875ms)
      ✓ should not let vote nonVoting key (57ms)
      ✓ should not let vote before startTime key (102ms)
      ✓ should not let vote after endTime key (97ms)
      ✓ should not let vote with already voted key (271ms)
      ✓ should not let vote with invalid choice (267ms)
      ✓ should not let vote with invalid id (170ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (803ms)
      ✓ finalize addition of payout key (933ms)
      ✓ finalize addition of VotingKey (1027ms)
      ✓ cannot create ballot for using previous mining key (2257ms)
      ✓ finalize addition of MiningKey (1144ms)
      ✓ finalize removal of MiningKey (2097ms)
      ✓ finalize removal of VotingKey (1237ms)
      ✓ finalize removal of PayoutKey (1178ms)
      ✓ finalize swap of VotingKey (1216ms)
      ✓ finalize swap of PayoutKey (1178ms)
      ✓ finalize swap of MiningKey (1373ms)
      ✓ prevent double finalize (1841ms)
      ✓ allowed at once after all validators gave their votes (1730ms)
    #migrate
      ✓ should copy a ballot to the new contract (2013ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (98ms)
      ✓ should change implementation address (101ms)
      ✓ should increment implementation version (98ms)
      ✓ new implementation should work (148ms)
      ✓ new implementation should use the same proxyStorage address (186ms)
      ✓ new implementation should use the same storage (963ms)
  Contract: Voting to change keys upgraded [all features]
    #createBallot
      ✓ happy path (782ms)
      ✓ should not let create voting with invalid duration (187ms)
      ✓ should not let add votingKey for MoC (624ms)
      ✓ should not let add votingKey for 0x0 (518ms)
      ✓ should not let add payoutKey for 0x0 (480ms)
      ✓ should not let create more ballots than the limit (10430ms)
    #createBallotToAddNewValidator
      ✓ happy path (316ms)
      ✓ deny adding already existed voting key
      ✓ deny adding already existed payout key (227ms)
      ✓ should create validator with all keys after finalization (1418ms)
      ✓ should allow removing new validator if finalizeChange did not happen (2165ms)
    #vote
      ✓ should let a validator to vote (190ms)
      ✓ reject vote should be accepted (196ms)
      ✓ should allow multiple voters to vote (831ms)
      ✓ should not let vote nonVoting key (57ms)
      ✓ should not let vote before startTime key (93ms)
      ✓ should not let vote after endTime key (94ms)
      ✓ should not let vote with already voted key (191ms)
      ✓ should not let vote with invalid choice (179ms)
      ✓ should not let vote with invalid id (173ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (830ms)
      ✓ finalize addition of payout key (910ms)
      ✓ finalize addition of VotingKey (1022ms)
      ✓ cannot create ballot for using previous mining key (2234ms)
      ✓ finalize addition of MiningKey (1023ms)
      ✓ finalize removal of MiningKey (2017ms)
      ✓ finalize removal of VotingKey (1237ms)
      ✓ finalize removal of PayoutKey (1142ms)
      ✓ finalize swap of VotingKey (1172ms)
      ✓ finalize swap of PayoutKey (1155ms)
      ✓ finalize swap of MiningKey (1503ms)
      ✓ prevent double finalize (1828ms)
      ✓ allowed at once after all validators gave their votes (1722ms)
    #migrate
      ✓ should copy a ballot to the new contract (2024ms)
  Contract: VotingToChangeMinThreshold [all features]
    #createBallot
      ✓ happy path (377ms)
      ✓ proposed value should be more than or equal to 3
      ✓ proposed value should not be equal to the same value
      ✓ should not let create more ballots than the limit (10284ms)
    #vote
      ✓ should let a validator to vote (181ms)
      ✓ reject vote should be accepted (407ms)
      ✓ should allow multiple voters to vote (422ms)
      ✓ should not let vote nonVoting key (69ms)
      ✓ should not let vote before startTime key (91ms)
      ✓ should not let vote after endTime key (95ms)
      ✓ should not let vote with already voted key (209ms)
      ✓ should not let vote with invalid choice (166ms)
      ✓ should not let vote with invalid id (169ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (561ms)
      ✓ should change to proposedValue when quorum is reached (1253ms)
      ✓ prevents double finalize (1671ms)
      ✓ allowed at once after all validators gave their votes (2039ms)
      ✓ should decrease validator limit only once when calling finalize more than once (1589ms)
    #migrate
      ✓ should copy a ballot to the new contract (1495ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (77ms)
      ✓ should change implementation address (93ms)
      ✓ should increment implementation version (91ms)
      ✓ new implementation should work (120ms)
      ✓ new implementation should use the same proxyStorage address (89ms)
      ✓ new implementation should use the same storage (585ms)
  Contract: VotingToChangeMinThreshold upgraded [all features]
    #createBallot
      ✓ happy path (271ms)
      ✓ proposed value should be more than or equal to 3 (133ms)
      ✓ proposed value should not be equal to the same value
      ✓ should not let create more ballots than the limit (10305ms)
    #vote
      ✓ should let a validator to vote (194ms)
      ✓ reject vote should be accepted (190ms)
      ✓ should allow multiple voters to vote (481ms)
      ✓ should not let vote nonVoting key (51ms)
      ✓ should not let vote before startTime key (108ms)
      ✓ should not let vote after endTime key (108ms)
      ✓ should not let vote with already voted key (193ms)
      ✓ should not let vote with invalid choice (182ms)
      ✓ should not let vote with invalid id (262ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (560ms)
      ✓ should change to proposedValue when quorum is reached (1312ms)
      ✓ prevents double finalize (1806ms)
      ✓ allowed at once after all validators gave their votes (2331ms)
      ✓ should decrease validator limit only once when calling finalize more than once (1595ms)
    #migrate
      ✓ should copy a ballot to the new contract (1508ms)
  Contract: VotingToChangeProxyAddress [all features]
    #createBallot
      ✓ happy path (278ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (489ms)
      ✓ should not let create more ballots than the limit (9893ms)
    #vote
      ✓ should let a validator to vote (183ms)
      ✓ reject vote should be accepted (284ms)
      ✓ should allow multiple voters to vote (852ms)
      ✓ should not let vote nonVoting key (52ms)
      ✓ should not let vote before startTime key (103ms)
      ✓ should not let vote after endTime key (97ms)
      ✓ should not let vote with already voted key (195ms)
      ✓ should not let vote with invalid choice (181ms)
      ✓ should not let vote with invalid id (180ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (598ms)
      ✓ should change KeysManager implementation (920ms)
      ✓ should change VotingToChangeKeys implementation (1053ms)
      ✓ should change VotingToChangeMinThreshold implementation (995ms)
      ✓ should change VotingToChangeProxy implementation (1083ms)
      ✓ should change BallotsStorage implementation (1075ms)
      ✓ should change ValidatorMetadata implementation (1062ms)
      ✓ should change ProxyStorage implementation (1068ms)
      ✓ prevents double finalize (1513ms)
      ✓ allowed at once after all validators gave their votes (1768ms)
    #migrate
      ✓ should copy a ballot to the new contract (1995ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (88ms)
      ✓ should change implementation address (87ms)
      ✓ should increment implementation version (113ms)
      ✓ new implementation should work (139ms)
      ✓ new implementation should use the same proxyStorage address (86ms)
      ✓ new implementation should use the same storage (620ms)
  Contract: VotingToChangeProxyAddress upgraded [all features]
    #createBallot
      ✓ happy path (395ms)
      ✓ proposed address should not be 0x0 (119ms)
      ✓ can create multiple ballots (394ms)
      ✓ should not let create more ballots than the limit (10105ms)
    #vote
      ✓ should let a validator to vote (179ms)
      ✓ reject vote should be accepted (194ms)
      ✓ should allow multiple voters to vote (805ms)
      ✓ should not let vote nonVoting key (55ms)
      ✓ should not let vote before startTime key (103ms)
      ✓ should not let vote after endTime key (213ms)
      ✓ should not let vote with already voted key (224ms)
      ✓ should not let vote with invalid choice (225ms)
      ✓ should not let vote with invalid id (196ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (684ms)
      ✓ should change KeysManager implementation (1177ms)
      ✓ should change VotingToChangeKeys implementation (1182ms)
      ✓ should change VotingToChangeMinThreshold implementation (1065ms)
      ✓ should change VotingToChangeProxy implementation (1115ms)
      ✓ should change BallotsStorage implementation (985ms)
      ✓ should change ValidatorMetadata implementation (1082ms)
      ✓ should change ProxyStorage implementation (1080ms)
      ✓ prevents double finalize (1522ms)
      ✓ allowed at once after all validators gave their votes (1686ms)
    #migrate
      ✓ should copy a ballot to the new contract (2022ms)
  Contract: VotingToManageEmissionFunds [all features]
    #init
      ✓ should change state correctly (119ms)
      ✓ cannot be called more than once
    #createBallot
      ✓ happy path (866ms)
      ✓ may only be called by valid voting key (139ms)
      ✓ endTime must be greater than startTime
      ✓ startTime must be greater than current time (39ms)
      ✓ cannot be called before emission release time (64ms)
      ✓ ballot cannot last longer than distribution threshold (55ms)
      ✓ receiver address should not be 0x0 (64ms)
      ✓ cannot create multiple ballots during the same distribution period (435ms)
      ✓ should allow creating new ballot after the next emission release threshold (490ms)
    #cancelNewBallot
      ✓ happy path (880ms)
      ✓ cannot cancel nonexistent or finalized ballot (341ms)
      ✓ may only be called by creator of a ballot (232ms)
      ✓ may only be called within ballot canceling threshold (265ms)
      ✓ cannot cancel already cancelled ballot (221ms)
      ✓ should restore emission release time (493ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (130ms)
      ✓ should update to the next threshold (72ms)
      ✓ should update to the future threshold (86ms)
    #vote
      ✓ should let a validator to vote (959ms)
      ✓ should allow multiple voters to vote (1497ms)
      ✓ should not let vote by nonvoting key (57ms)
      ✓ should not let vote before startTime (94ms)
      ✓ should not let vote after endTime (260ms)
      ✓ should not let vote with already voted key (207ms)
      ✓ should not let vote with invalid choice (152ms)
      ✓ should not let vote with invalid id (164ms)
      ✓ should not let vote if already finalized (1535ms)
      ✓ should not let vote with old miningKey (2431ms)
      ✓ should not let vote if ballot is canceled (256ms)
    #finalize
      ✓ happy path (591ms)
      ✓ freeze funds if it did not pass minimum voters count (1036ms)
      ✓ freeze funds if there is no majority of 3 votes (1322ms)
      ✓ freeze funds if there is no majority of 4 votes (1678ms)
      ✓ send funds to receiver if most votes are for sending (2089ms)
      ✓ send funds to receiver if most votes are for sending (1749ms)
      ✓ burn funds if most votes are for burning (1704ms)
      ✓ prevents finalize with invalid id (280ms)
      ✓ do not let finalize if a ballot is active (189ms)
      ✓ finalize immediately if the last validator gave his vote (1187ms)
      ✓ does not finalize immediately until ballot canceling threshold is reached (1236ms)
      ✓ prevents double finalize (279ms)
      ✓ should refresh emission release time (256ms)
      ✓ deny finalization if the voting key is a contract (703ms)
      ✓ deny finalization within ballot canceling threshold (301ms)
      ✓ deny finalization of canceled ballot (461ms)
    #upgradeTo
      ✓ may only be called by ProxyStorage (91ms)
      ✓ should change implementation address (92ms)
      ✓ should increment implementation version (91ms)
      ✓ new implementation should work (129ms)
      ✓ new implementation should use the same proxyStorage address (92ms)
      ✓ new implementation should use the same storage (960ms)
  Contract: VotingToManageEmissionFunds upgraded [all features]
    #init
      ✓ should change state correctly (111ms)
      ✓ cannot be called more than once
    #createBallot
      ✓ happy path (835ms)
      ✓ may only be called by valid voting key (142ms)
      ✓ endTime must be greater than startTime (45ms)
      ✓ startTime must be greater than current time (126ms)
      ✓ cannot be called before emission release time (64ms)
      ✓ ballot cannot last longer than distribution threshold (41ms)
      ✓ receiver address should not be 0x0 (52ms)
      ✓ cannot create multiple ballots during the same distribution period (467ms)
      ✓ should allow creating new ballot after the next emission release threshold (464ms)
    #cancelNewBallot
      ✓ happy path (878ms)
      ✓ cannot cancel nonexistent or finalized ballot (300ms)
      ✓ may only be called by creator of a ballot (290ms)
      ✓ may only be called within ballot canceling threshold (250ms)
      ✓ cannot cancel already cancelled ballot (244ms)
      ✓ should restore emission release time (601ms)
    #refreshEmissionReleaseTime
      ✓ should not update until the next threshold (129ms)
      ✓ should update to the next threshold (273ms)
      ✓ should update to the future threshold (72ms)
    #vote
      ✓ should let a validator to vote (842ms)
      ✓ should allow multiple voters to vote (1572ms)
      ✓ should not let vote by nonvoting key (60ms)
      ✓ should not let vote before startTime (89ms)
      ✓ should not let vote after endTime (253ms)
      ✓ should not let vote with already voted key (202ms)
      ✓ should not let vote with invalid choice (173ms)
      ✓ should not let vote with invalid id (155ms)
      ✓ should not let vote if already finalized (1404ms)
      ✓ should not let vote with old miningKey (2283ms)
      ✓ should not let vote if ballot is canceled (152ms)
    #finalize
      ✓ happy path (569ms)
      ✓ freeze funds if it did not pass minimum voters count (1142ms)
      ✓ freeze funds if there is no majority of 3 votes (1393ms)
      ✓ freeze funds if there is no majority of 4 votes (1872ms)
      ✓ send funds to receiver if most votes are for sending (2304ms)
      ✓ send funds to receiver if most votes are for sending (1816ms)
      ✓ burn funds if most votes are for burning (1898ms)
      ✓ prevents finalize with invalid id (209ms)
      ✓ do not let finalize if a ballot is active (211ms)
      ✓ finalize immediately if the last validator gave his vote (1281ms)
      ✓ does not finalize immediately until ballot canceling threshold is reached (1316ms)
      ✓ prevents double finalize (292ms)
      ✓ should refresh emission release time (265ms)
      ✓ deny finalization if the voting key is a contract (737ms)
      ✓ deny finalization within ballot canceling threshold (305ms)
      ✓ deny finalization of canceled ballot (284ms)
  598 passing (18m)
 ```
