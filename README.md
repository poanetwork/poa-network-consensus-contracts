# poa-network-consensus-contracts

## Setup of the ceremony

### Prerequisites

- Python 3.5+, pip
- solc, the Solidity compiler

### Start POA network

- Install solidity-flattener `pip3.5 install solidity-flattener`
- Create `./flat` directory `mkdir flat`
- Install npm dependencies `npm i`
- Generate flat sources of contracts with the script `./make_flat.sh`
- We need the byte code of `PoaNetworkConsensus_flat` contract to add it to [`spec.json`](https://github.com/oraclesorg/oracles-chain-spec/blob/master/spec.json) of the network. Go to [Remix](http://remix.ethereum.org/#version=soljson-v0.4.18+commit.9cf6e910.js). Copy `./flat/PoaNetworkConsensus_flat.sol` source to the input field and press `Start to compile`. Choose `PoaNetworkConsensus` contract in the listbox and press "Details". Copy `BYTECODE` of the compiled source for `spec.json`.

### Add Contracts to Parity UI.

Start Parity UI. In the contracts section press `Develop` button. 
Select `0.4.18` Solidity compiler version. Set `Optimize` to `true`.

- In Parity UI `Contracts` tab choose watch custom contract. Paste bytecode and ABI of `PoaNetworkConsensus` contract from Remix.

Compile and deploy contracts in the next sequence:

- `ProxyStorage_flat.sol` - Select contract `ProxyStorage` with constructor parameters: `_poaConsensus` - address of poaConsensus contract, `_moc` - address of Master of Ceremony. Then from poaNetworkConsensus contract send transaction `setProxyStorage` with the address of ProxyStorage contract.
- `KeysManager_flat.sol` - Select contract `KeysManager` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract, `_poaConsensus` - address of poaConsensus contract, `_moc` - address of Master of Ceremony.
- `BallotsStorage_flat.sol` - Select contract `BallotsStorage` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeKeys_flat.sol` - Select contract `VotingToChangeKeys` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeMinThreshold_flat.sol` - Select contract `VotingToChangeMinThreshold` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `VotingToChangeProxyAddress_flat.sol` - Select contract `VotingToChangeProxyAddress` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract
- `ValidatorMetadata_flat.sol` - Select contract `ValidatorMetadata` with constructor parameters: `_proxyStorage` - address of ProxyStorage contract

## Unit tests

### [PoaNetworkConsensus](https://github.com/oraclesorg/poa-network-consensus-contracts/blob/master/contracts/PoaNetworkConsensus.sol) contract.

This is the contract, which stores data for PoA Oracles Network consensus.

| № | Description                                             | Status |
|---|:-----------------------------------------------------|:--------------------------:|
| 1 | Checks, that finalized is false by default     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 2 | Checks, that systemAddress exists     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 3 | finalizeChange should only be called by systemAddress     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 4 | finalizeChange should set finalized to true     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 5 | finalizeChange should set currentValidators to pendingList     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 6 | finalizeChange sets currentValidators to pendingList after addValidator call     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 7 | addValidator should add validator     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 8 | addValidator should be called only from keys manager     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 9 | addValidator should not allow to add already existing validator     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 10 | addValidator should not allow 0x0 addresses     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 11 | addValidator should set validatorsState for new validator     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 12 | addValidator should set finalized to false     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 13 | addValidator should emit InitiateChange with blockhash and pendingList as params     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 14 | removeValidator should remove validator     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 15 | removeValidator should be called only either from ballot manager or keys manager     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 16 | removeValidator should only be allowed to remove from existing set of validators     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 17 | removeValidator should decrease length of pendingList     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 18 | removeValidator should change validatorsState     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 19 | removeValidator should set finalized to false     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 20 | setKeysManager should only be called from BallotsManager to set an address     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 21 | setKeysManager should not allow 0x0 addresses     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 22 | setKeysManager newAddress should not be equal to ballotsManager address     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 23 | setBallotsManager should only be called from BallotsManager to set an address     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 24 | setBallotsManager should not allow 0x0 addresses     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 25 | newAddress should not be equal to ballotsManager address from setBallotsManager     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |

### [KeysManager](https://github.com/oraclesorg/poa-network-consensus-contracts/blob/master/contracts/KeysManager.sol) contract.
| № | Description                                             | Status |
|---|:-----------------------------------------------------|:--------------------------:|
| 1 | Constructor sets owner to the master of ceremony     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 2 | initiateKeys can only be called by master of ceremony     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 3 | initiateKeys cannot allow 0x0 addresses     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 4 | initiateKeys should not allow to initialize already initialized key     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 5 | initiateKeys should not equal to master of ceremony     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 6 | initiateKeys should not allow to initialize more than maxNumberOfInitialKeys     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 7 | initiateKeys should increment initialKeyCount by 1     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 8 | initiateKeys should set initialKeys hash to true     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 9 | createKeys should only be called from initialized key     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 10 | createKeys params should not be equal to each other     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 11 | createKeys any of params should be equal to initialKey     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |
| 12 | createKeys should assign mining, voting, payout keys to relative mappings     | ![good](https://cdn.rawgit.com/primer/octicons/62c672732695b6429678bcd321520c41af109475/build/svg/check.svg) |

### BallotsManager contract.

### MetaData contract.

