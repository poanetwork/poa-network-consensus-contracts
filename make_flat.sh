#!/usr/bin/env bash

#pip3 install solidity-flattener --no-cache-dir -U
#sudo add-apt-repository ppa:ethereum/ethereum
#sudo apt-get update
#sudo apt-get install solc
rm -rf flat/*
solidity_flattener contracts/KeysManager.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/KeysManager_flat.sol
solidity_flattener contracts/PoaNetworkConsensus.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/PoaNetworkConsensus_flat.sol
solidity_flattener contracts/VotingToChangeKeys.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/VotingToChangeKeys_flat.sol
solidity_flattener contracts/VotingToChangeMinThreshold.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/VotingToChangeMinThreshold_flat.sol
solidity_flattener contracts/ValidatorMetadata.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/ValidatorMetadata_flat.sol
solidity_flattener contracts/ProxyStorage.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/ProxyStorage_flat.sol
solidity_flattener contracts/BallotsStorage.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/BallotsStorage_flat.sol
solidity_flattener contracts/VotingToChangeProxyAddress.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/VotingToChangeProxyAddress_flat.sol
solidity_flattener contracts/eternal-storage/EternalStorageProxy.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/EternalStorageProxy_flat.sol
solidity_flattener contracts/RewardByBlock.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/RewardByBlock_flat.sol
solidity_flattener contracts/RewardByTime.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/RewardByTime_flat.sol
solidity_flattener contracts/EmissionFunds.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/EmissionFunds_flat.sol
solidity_flattener contracts/VotingToManageEmissionFunds.sol | sed "1s/.*/pragma solidity ^0.4.24;/" > flat/VotingToManageEmissionFunds_flat.sol