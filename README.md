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
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `ValidatorMetadata_flat.sol` - Select contract `ValidatorMetadata` and send transaction `initProxyAddress` with the address of ProxyStorage contract
- `EternalStorageProxy_flat.sol` - Select contract `EternalStorageProxy` with constructor parameters: <br />
`_proxyStorage` - address of ProxyStorage contract,
`_implementationAddress` - address of ValidatorMetadata contract.
-  Select deployed `ProxyStorage` contract and make a call from MoC address to `initializeAddresses` with relevant addresses.

## Unit tests
[Full Test Report](https://poanetwork.github.io/poa-network-consensus-contracts/mochawesome.html)<br />

```
  Contract: BallotsStorage [all features]
    #contstuctor
      ✓ sets MoC and Poa (50ms)
    #setThreshold
      ✓ can only be called from votingToChangeThreshold address (107ms)
      ✓ cannot be set for Invalid threshold (151ms)
      ✓ new value cannot be equal to 0 (163ms)
      ✓ sets new value for Keys threshold (72ms)
      ✓ sets new value for MetadataChange threshold (66ms)
    #getTotalNumberOfValidators
      ✓ returns total number of validators (267ms)
    #getProxyThreshold
      ✓ returns total number of validators (562ms)
    #getVotingToChangeThreshold
      ✓ returns voting to change min threshold address (97ms)
    #getBallotLimit
      ✓ returns limit per validator to create ballots (248ms)
  Contract: KeysManager [all features]
    #constructor
      ✓ sets masterOfCeremony, proxyStorage, poaConsensus (68ms)
      ✓ adds masterOfCeremony to validators hash
    #initiateKeys
      ✓ can only be called by master of ceremony (73ms)
      ✓ cannot allow 0x0 addresses (81ms)
      ✓ should not allow to initialize already initialized key (71ms)
      ✓ should not allow to initialize already initialized key after validator created mining key (148ms)
      ✓ should not equal to master of ceremony
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (192ms)
      ✓ should not allow to initialize more than maxNumberOfInitialKeys (569ms)
      ✓ should increment initialKeyCount by 1 (99ms)
      ✓ should set initialKeys hash to activated status (110ms)
    #createKeys
      ✓ should only be called from initialized key (157ms)
      ✓ params should not be equal to each other (132ms)
      ✓ any of params should not be equal to initialKey (125ms)
      ✓ should assign mining, voting, payout keys to relative mappings (248ms)
      ✓ should assigns voting <-> mining key relationship (161ms)
      ✓ adds validator to poaConsensus contract (166ms)
      ✓ should set validatorKeys hash (170ms)
      ✓ should set validatorKeys hash (139ms)
    #addMiningKey
      ✓ should only be called from votingToChangeKeys (138ms)
      ✓ should not let add more than maxLimit (79ms)
      ✓ should set validatorKeys hash (107ms)
    #addVotingKey
      ✓ should add VotingKey (212ms)
      ✓ should only be called if mining is active (244ms)
      ✓ swaps keys if voting already exists (275ms)
    #addPayoutKey
      ✓ should add PayoutKey (183ms)
      ✓ should only be called if mining is active (225ms)
      ✓ swaps keys if voting already exists (253ms)
    #removeMiningKey
      ✓ should remove miningKey (306ms)
      ✓ removes validator from poaConsensus (418ms)
      ✓ should still enforce removal of votingKey to 0x0 even if voting key didnot exist (302ms)
    #removeVotingKey
      ✓ should remove votingKey (334ms)
    #removePayoutKey
      ✓ should remove payoutKey (292ms)
    #swapMiningKey
      ✓ should swap mining key (278ms)
      ✓ should keep voting and payout keys (575ms)
    #swapVotingKey
      ✓ should swap voting key (225ms)
    #swapPayoutKey
      ✓ should swap payout key (267ms)
    #migrateInitialKey
      ✓ can copy initial keys (285ms)
      ✓ copies validator keys (800ms)
      ✓ throws when trying to copy invalid mining key (154ms)
  Contract: ValidatorMetadata [all features]
    #createMetadata
      ✓ happy path (144ms)
      ✓ should not let create metadata if called by non-voting key (65ms)
      ✓ should not let create metadata if called second time (171ms)
    #getMiningByVotingKey
      ✓ happy path (98ms)
    #changeRequest
      ✓ happy path (247ms)
      ✓ should not let call if there is no metadata (48ms)
      ✓ resets confirmations when changeRequest recreated (663ms)
    #cancelPendingChange
      ✓ happy path (417ms)
      ✓ should not let delete records for someone else miningKey (428ms)
    #confirmPendingChange
      ✓ should not let confirm your own changes (299ms)
      ✓ should confirm changes (282ms)
      ✓ prevent from double voting (336ms)
    #finalize
      ✓ happy path (792ms)
    #getMinThreshold
      ✓ returns default value
  Contract: PoaNetworkConsensus [all features]
    default values
      ✓ finalized should be false (38ms)
      ✓ checks systemAddress
      ✓ allows you to set current list of validators (137ms)
    #finalizeChange
      ✓ should only be called by systemAddress (109ms)
      ✓ should set finalized to true (107ms)
      ✓ should set currentValidators to pendingList (114ms)
      ✓ set currentValidators to pendingList after addValidator call (458ms)
    #addValidator
      ✓ should be called only from keys manager (98ms)
      ✓ should not allow to add already existing validator (100ms)
      ✓ should not allow 0x0 addresses (117ms)
      ✓ should set validatorsState for new validator (121ms)
      ✓ should set finalized to false (97ms)
      ✓ should emit InitiateChange with blockhash and pendingList as params (109ms)
    #removeValidator
      ✓ should remove validator (130ms)
      ✓ should be called only from keys manager (167ms)
      ✓ should only be allowed to remove from existing set of validators (52ms)
      ✓ should decrease length of pendingList (364ms)
      ✓ should change validatorsState (160ms)
      ✓ should set finalized to false (159ms)
    #setProxyStorage
      ✓ can be called by any validator (101ms)
      ✓ can only be called once
      ✓ cannot be set to 0x0 address (62ms)
      ✓ sets proxyStorage (86ms)
      ✓ sets isMasterOfCeremonyInitialized (69ms)
      ✓ emits MoCInitializedProxyStorage (59ms)
      ✓ #getKeysManager (121ms)
      ✓ #getVotingToChangeKeys (90ms)
    #isValidator
      ✓ returns address of miner (40ms)
  Contract: ProxyStorage [all features]
    #contstuctor
      ✓ sets MoC and Poa (49ms)
    #initializeAddresses
      ✓ sets all addresses (176ms)
      ✓ prevents Moc to call it more than once (116ms)
    #setContractAddress
      ✓ can only be called from votingToChangeProxy address (61ms)
      ✓ cannot be set to 0x0 address
      ✓ sets keysManager (47ms)
      ✓ sets votingToChangeKeys (40ms)
      ✓ sets votingToChangeMinThreshold (44ms)
      ✓ sets votingToChangeProxy (60ms)
      ✓ sets ballotsStorage (39ms)
      ✓ sets ballotsStorage (48ms)
  Contract: Voting to change keys [all features]
    #constructor
      ✓ happy path (420ms)
      ✓ should not let create voting with invalid duration (135ms)
100
      ✓ should not let create more ballots than the limit (13983ms)
    #vote
      ✓ should let a validator to vote (206ms)
      ✓ reject vote should be accepted (184ms)
      ✓ should allow multiple voters to vote (942ms)
      ✓ should not let vote nonVoting key (71ms)
      ✓ should not let vote before startTime key (124ms)
      ✓ should not let vote after endTime key (133ms)
      ✓ should not let vote with already voted key (268ms)
      ✓ should not let vote with invalid choice (273ms)
      ✓ should not let vote with invalid id (221ms)
    #finalize
      ✓ happy path - no action since it didnot meet minimum number of totalVoters (673ms)
      ✓ finalize addition of payout key (828ms)
      ✓ finalize addition of VotingKey (997ms)
      ✓ cannot create ballot for using previous mining key (2325ms)
      ✓ finalize addition of MiningKey (1150ms)
      ✓ finalize removal of MiningKey (1270ms)
      ✓ finalize removal of VotingKey (1173ms)
      ✓ finalize removal of PayoutKey (1182ms)
      ✓ finalize swap of VotingKey (1096ms)
      ✓ finalize swap of PayoutKey (1197ms)
      ✓ finalize swap of MiningKey (1339ms)
      ✓ prevent double finalize (1658ms)
  Contract: VotingToChangeMinThreshold [all features]
    #createBallotToChangeThreshold
      ✓ happy path (232ms)
      ✓ proposed value should be more than or equal to 3 (42ms)
      ✓ proposed value should not be equal to the same value (52ms)
100
      ✓ should not let create more ballots than the limit (13742ms)
    #vote
      ✓ should let a validator to vote (194ms)
      ✓ reject vote should be accepted (213ms)
      ✓ should allow multiple voters to vote (500ms)
      ✓ should not let vote nonVoting key (66ms)
      ✓ should not let vote before startTime key (122ms)
      ✓ should not let vote after endTime key (124ms)
      ✓ should not let vote with already voted key (207ms)
      ✓ should not let vote with invalid choice (220ms)
      ✓ should not let vote with invalid id (234ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (550ms)
      ✓ should change to proposedValue when quorum is reached (1276ms)
      ✓ prevents double finalize (1700ms)
  Contract: VotingToChangeProxyAddress [all features]
    #createBallotToChangeProxyAddress
      ✓ happy path (254ms)
      ✓ proposed address should not be 0x0
      ✓ can creates multiple ballots (434ms)
100
      ✓ should not let create more ballots than the limit (13379ms)
    #vote
      ✓ should let a validator to vote (200ms)
      ✓ reject vote should be accepted (170ms)
      ✓ should allow multiple voters to vote (812ms)
      ✓ should not let vote nonVoting key (63ms)
      ✓ should not let vote before startTime key (104ms)
      ✓ should not let vote after endTime key (122ms)
      ✓ should not let vote with already voted key (218ms)
      ✓ should not let vote with invalid choice (220ms)
      ✓ should not let vote with invalid id (201ms)
    #finalize
      ✓ doesnot change if it did not pass minimum threshold (588ms)
      ✓ should change getKeysManager address (763ms)
      ✓ should change getVotingToChangeKeys (951ms)
      ✓ should change getVotingToChangeMinThreshold (921ms)
      ✓ should change getVotingToChangeProxy (955ms)
      ✓ should change getBallotsStorage (969ms)
      ✓ prevents double finalize (1358ms)
  163 passing (3m)
 ```

