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
Select `0.4.18` Solidity compiler version. Set `Optimize` to `true`.

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
      ✓ prevent from double init (42ms)
      ✓ thresholds are correct (49ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (100ms)
      ✓ cannot be set for Invalid threshold (153ms)
      ✓ new value cannot be equal to 0 (172ms)
      ✓ sets new value for Keys threshold (79ms)
      ✓ sets new value for MetadataChange threshold (71ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (252ms)
    #getProxyThreshold
      ✓ returns total number of validators (513ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (115ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (332ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (174ms)
      ✓ should change implementation address (240ms)
      ✓ should increment implementation version (271ms)
      ✓ new implementation should work (239ms)
      ✓ new implementation should use the same proxyStorage address (334ms)
      ✓ new implementation should use the same storage (311ms)

  Contract: BallotsStorage upgraded [all features]
    #init
      ✓ prevent from double init
      ✓ thresholds are correct (88ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (80ms)
      ✓ cannot be set for Invalid threshold (211ms)
      ✓ new value cannot be equal to 0 (159ms)
      ✓ sets new value for Keys threshold (74ms)
      ✓ sets new value for MetadataChange threshold (70ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (207ms)
    #getProxyThreshold
      ✓ returns total number of validators (551ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (193ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (389ms)

  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (54ms)
      ✓ adds masterOfCeremony to validators hash
    #initiateKeys
      ✓ can only be called by master of ceremony (65ms)
      ✓ cannot allow 0x0 addresses (57ms)
      ✓ should not allow to initialize already initialized key (70ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (181ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (142ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (532ms)
      ✓ should increment initialKeyCount by 1 (82ms)
      ✓ should set initialKeys hash to activated status (109ms)
    #createKeys
      ✓ should only be called from initialized key (191ms)
      ✓ params should not be equal to each other (117ms)
      ✓ any of params should not be equal to initialKey (119ms)
      ✓ should assign mining, voting, payout keys to relative mappings (214ms)
      ✓ should assigns voting <-> mining key relationship (143ms)
      ✓ adds validator to poaConsensus contract (144ms)
      ✓ should set validatorKeys hash (134ms)
      ✓ should set validatorKeys hash (156ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (142ms)
      ✓ should not let add more than maxLimit (68ms)
      ✓ should set validatorKeys hash (115ms)
    #addVotingKey
      ✓ should add VotingKey (193ms)
      ✓ should only be called if mining is active (284ms)
      ✓ swaps keys if voting already exists (238ms)
    #addPayoutKey
      ✓ should add PayoutKey (152ms)
      ✓ should only be called if mining is active (199ms)
      ✓ swaps keys if voting already exists (246ms)
    #removeMiningKey
      ✓ should remove miningKey (337ms)
      ✓ removes validator from poaConsensus (437ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (312ms)
    #removeVotingKey
      ✓ should remove votingKey (281ms)
    #removePayoutKey
      ✓ should remove payoutKey (331ms)
    #swapMiningKey
      ✓ should swap mining key (276ms)
      ✓ should keep voting and payout keys (524ms)
    #swapVotingKey
      ✓ should swap voting key (228ms)
    #swapPayoutKey
      ✓ should swap payout key (272ms)
    #migrateInitialKey
      ✓ can copy initial keys (314ms)
      ✓ copies validator keys (779ms)
      ✓ throws when trying to copy invalid mining key (161ms)

  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (162ms)
      ✓ should not let create metadata if called by non-voting key (100ms)
      ✓ should not let create metadata if called second time (204ms)
    #getMiningByVotingKey
      ✓ happy path (72ms)
    #changeRequest
      ✓ happy path (223ms)
      ✓ should not let call if there is no metadata (41ms)
      ✓ resets confirmations when changeRequest recreated (602ms)
    #cancelPendingChange
      ✓ happy path (634ms)
      ✓ should not let delete records for someone else miningKey (593ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (334ms)
      ✓ should confirm changes (400ms)
      ✓ prevent from double voting (394ms)
    #finalize
      ✓ happy path (777ms)
    #getMinThreshold
      ✓ returns default value (69ms)
    #setProxyAddress
      ✓ can request a new proxy address (431ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (130ms)
      ✓ should change implementation address (210ms)
      ✓ should increment implementation version (149ms)
      ✓ new implementation should work (190ms)
      ✓ new implementation should use the same proxyStorage address (127ms)
      ✓ new implementation should use the same storage (397ms)

  Contract: ValidatorMetadata upgraded [all features]
    #createMetadata
      ✓ happy path (167ms)
      ✓ should not let create metadata if called by non-voting key (91ms)
      ✓ should not let create metadata if called second time (178ms)
    #getMiningByVotingKey
      ✓ happy path (69ms)
    #changeRequest
      ✓ happy path (189ms)
      ✓ should not let call if there is no metadata
      ✓ resets confirmations when changeRequest recreated (593ms)
    #cancelPendingChange
      ✓ happy path (552ms)
      ✓ should not let delete records for someone else miningKey (561ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (337ms)
      ✓ should confirm changes (364ms)
      ✓ prevent from double voting (422ms)
    #finalize
      ✓ happy path (727ms)
    #getMinThreshold
      ✓ returns default value (40ms)
    #setProxyAddress
      ✓ can request a new proxy address (370ms)

  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false (47ms)
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (141ms)
    #finalizeChange
      ✓ should only be called by systemAddress (103ms)
      ✓ should set finalized to true (91ms)
      ✓ should set currentValidators to pendingList (202ms)
      ✓ set currentValidators to pendingList after addValidator call (417ms)
    #addValidator
      ✓ should be called only from keys manager (109ms)
      ✓ should not allow to add already existing validator (101ms)
      ✓ should not allow 0x0 addresses (85ms)
      ✓ should set validatorsState for new validator (124ms)
      ✓ should set finalized to false (122ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (111ms)
    #removeValidator
      ✓ should remove validator (126ms)
      ✓ should be called only from keys manager (168ms)
      ✓ should only be allowed to remove from existing set of validators (69ms)
      ✓ should decrease length of pendingList (454ms)
      ✓ should change validatorsState (183ms)
      ✓ should set finalized to false (199ms)
    #setProxyStorage
      ✓ can be called by any validator (93ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address (54ms)
      ✓ sets proxyStorage (69ms)
      ✓ sets isMasterOfCeremonyInitialized (77ms)
      ✓ emits MoCInitializedProxyStorage (64ms)
      ✓ #getKeysManager (81ms)
      ✓ #getVotingToChangeKeys (72ms)
    #isValidator
      ✓ returns address of miner (39ms)

  Contract: ProxyStorage [all features]
    #constructor
      ✓ sets MoC and Poa (47ms)
    #initializeAddresses
      ✓ sets all addresses (188ms)
      ✓ prevents Moc to call it more than once (109ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (62ms)
      ✓ cannot be set to 0x0 address
      ✓ sets keysManager (49ms)
      ✓ sets votingToChangeKeys (144ms)
      ✓ sets votingToChangeKeysEternalStorage (100ms)
      ✓ sets votingToChangeMinThreshold (54ms)
      ✓ sets votingToChangeProxy (50ms)
      ✓ sets ballotsStorage (252ms)
      ✓ sets ballotsEternalStorage (93ms)
      ✓ sets poaConsensus (50ms)
      ✓ sets validatorMetadata (189ms)
      ✓ sets validatorMetadataEternalStorage (106ms)

  Contract: Voting to change keys [all features]
    #constructor
      ✓ happy path (818ms)
      ✓ should not let create voting with invalid duration (134ms)
      ✓ should not let create more ballots than the limit (13337ms)
    #vote
      ✓ should let a validator to vote (297ms)
      ✓ reject vote should be accepted (270ms)
      ✓ should allow multiple voters to vote (1076ms)
      ✓ should not let vote nonVoting key (86ms)
      ✓ should not let vote before startTime key (142ms)
      ✓ should not let vote after endTime key (131ms)
      ✓ should not let vote with already voted key (256ms)
      ✓ should not let vote with invalid choice (268ms)
      ✓ should not let vote with invalid id (248ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (1215ms)
      ✓ finalize addition of payout key (1469ms)
      ✓ finalize addition of VotingKey (1507ms)
      ✓ cannot create ballot for using previous mining key (3391ms)
      ✓ finalize addition of MiningKey (1709ms)
      ✓ finalize removal of MiningKey (1970ms)
      ✓ finalize removal of VotingKey (3592ms)
      ✓ finalize removal of PayoutKey (2974ms)
      ✓ finalize swap of VotingKey (1931ms)
      ✓ finalize swap of PayoutKey (1414ms)
      ✓ finalize swap of MiningKey (1725ms)
      ✓ prevent double finalize (1922ms)
    #upgradeTo
      ✓ may be called only by ProxyStorage (158ms)
      ✓ should change implementation address (190ms)
      ✓ should increment implementation version (212ms)
      ✓ new implementation should work (229ms)
      ✓ new implementation should use the same proxyStorage address (127ms)
      ✓ new implementation should use the same storage (2446ms)

  Contract: Voting to change keys upgraded [all features]
    #constructor
      ✓ happy path (469ms)
      ✓ should not let create voting with invalid duration (135ms)
      ✓ should not let create more ballots than the limit (13292ms)
    #vote
      ✓ should let a validator to vote (204ms)
      ✓ reject vote should be accepted (223ms)
      ✓ should allow multiple voters to vote (903ms)
      ✓ should not let vote nonVoting key (78ms)
      ✓ should not let vote before startTime key (131ms)
      ✓ should not let vote after endTime key (128ms)
      ✓ should not let vote with already voted key (271ms)
      ✓ should not let vote with invalid choice (275ms)
      ✓ should not let vote with invalid id (240ms)
    #finalize
      ✓ happy path - no action since it did not meet minimum number of totalVoters (1067ms)
      ✓ finalize addition of payout key (1266ms)
      ✓ finalize addition of VotingKey (1397ms)
      ✓ cannot create ballot for using previous mining key (3032ms)
      ✓ finalize addition of MiningKey (1654ms)
      ✓ finalize removal of MiningKey (1730ms)
      ✓ finalize removal of VotingKey (1503ms)
      ✓ finalize removal of PayoutKey (1495ms)
      ✓ finalize swap of VotingKey (1844ms)
      ✓ finalize swap of PayoutKey (1679ms)
      ✓ finalize swap of MiningKey (1775ms)
      ✓ prevent double finalize (1779ms)

  Contract: VotingToChangeMinThreshold [all features]
    #createBallotToChangeThreshold
      ✓ happy path (263ms)
      ✓ proposed value should be more than or equal to 3 (76ms)
      ✓ proposed value should not be equal to the same value (65ms)
      ✓ should not let create more ballots than the limit (13605ms)
    #vote
      ✓ should let a validator to vote (168ms)
      ✓ reject vote should be accepted (243ms)
      ✓ should allow multiple voters to vote (385ms)
      ✓ should not let vote nonVoting key (68ms)
      ✓ should not let vote before startTime key (103ms)
      ✓ should not let vote after endTime key (113ms)
      ✓ should not let vote with already voted key (241ms)
      ✓ should not let vote with invalid choice (198ms)
      ✓ should not let vote with invalid id (188ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (534ms)
      ✓ should change to proposedValue when quorum is reached (1502ms)
      ✓ prevents double finalize (1792ms)

  Contract: VotingToChangeProxyAddress [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (263ms)
      ✓ proposed address should not be 0x0
      ✓ can create multiple ballots (854ms)
      ✓ should not let create more ballots than the limit (21777ms)
    #vote
      ✓ should let a validator to vote (873ms)
      ✓ reject vote should be accepted (430ms)
      ✓ should allow multiple voters to vote (948ms)
      ✓ should not let vote nonVoting key (79ms)
      ✓ should not let vote before startTime key (125ms)
      ✓ should not let vote after endTime key (147ms)
      ✓ should not let vote with already voted key (253ms)
      ✓ should not let vote with invalid choice (236ms)
      ✓ should not let vote with invalid id (231ms)
    #finalize
      ✓ does not change if it did not pass minimum threshold (717ms)
      ✓ should change getKeysManager address (1078ms)
      ✓ should change VotingToChangeKeys implementation (1123ms)
      ✓ should change VotingToChangeKeys storage (871ms)
      ✓ should change getVotingToChangeMinThreshold (945ms)
      ✓ should change getVotingToChangeProxy (915ms)
      ✓ should change BallotsStorage implementation (1026ms)
      ✓ should change BallotsStorage storage (983ms)
      ✓ should change ValidatorMetadata implementation (1020ms)
      ✓ should change ValidatorMetadata storage (1288ms)
      ✓ prevents double finalize (1394ms)
  241 passing (7m)
 ```
