
#!/usr/bin/env bash

#pip3 install solidity-flattener --no-cache-dir -U
rm -rf flat/*
solidity_flattener --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity contracts/KeysManager.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/KeysManager_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/PoaNetworkConsensus.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/PoaNetworkConsensus_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/VotingContract.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/VotingContract_flat.sol