#!/usr/bin/env bash

rm -rf flat/*
./node_modules/.bin/poa-solidity-flattener contracts/KeysManager.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/PoaNetworkConsensus.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/VotingToChangeKeys.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/VotingToChangeMinThreshold.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/ValidatorMetadata.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/ProxyStorage.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/BallotsStorage.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/VotingToChangeProxyAddress.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/eternal-storage/EternalStorageProxy.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/RewardByBlock.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/RewardByTime.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/EmissionFunds.sol ./flat
./node_modules/.bin/poa-solidity-flattener contracts/VotingToManageEmissionFunds.sol ./flat