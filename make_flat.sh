
#!/usr/bin/env bash

#pip3 install solidity-flattener --no-cache-dir -U
rm -rf flat/*
solidity_flattener --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity contracts/KeysManager.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/KeysManager_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/PoaNetworkConsensus.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/PoaNetworkConsensus_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/VotingToChangeKeys.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/VotingToChangeKeys_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/VotingToChangeMinThreshold.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/VotingToChangeMinThreshold_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/ValidatorMetadata.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/ValidatorMetadata_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/ProxyStorage.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/ProxyStorage_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/BallotsStorage.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/BallotsStorage_flat.sol
solidity_flattener  --solc-paths=zeppelin-solidity=$(pwd)/node_modules/zeppelin-solidity/ contracts/VotingToChangeProxyAddress.sol | sed "1s/.*/pragma solidity ^0.4.18;/" > flat/VotingToChangeProxyAddress_flat.sol