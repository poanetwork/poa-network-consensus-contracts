# How to use test-poa-setup.js

1. setup parity and write 4 toml config files.

- Master of ceremony node:
```bash
[parity]
chain = "spec.json"
base_path = "test_feofan"
[network]
port = 30305
discovery=true
[rpc]
cors = "all"
interface = "all"
hosts = ["all"]
port = 8545
apis = ["web3", "eth", "net", "parity", "traces", "rpc", "secretstore"]
[websockets]
disable = false
port = 8546
interface = "all"
origins = ["all"]
apis = ["web3", "eth", "net", "parity", "traces", "rpc", "secretstore"]
hosts = ["all"]
[footprint]
tracing = "on"
pruning = "archive"
fat_db = "on"
[account]
password = ["password"]
#unlock =["0x0039F22efB07A647557C7C5d17854CFD6D489eF3,0x030B90762Cee7a87ee4f51e715a302177043835e,0x4c718e4FdD135Db0Ddcf1c9421077edaF336e593,0x798a19fa3Ea264286A9C27353ECAe89872f46C7E"]
[mining]
force_sealing = true
engine_signer = "0x0039f22efb07a647557c7c5d17854cfd6d489ef3"
reseal_on_txs = "none"
```
In the toml config above, make sure you have the following: 
- chain = `spec.json` - file which will be used for your blockchain. Example: [parity_setup/spec.json](parity_setup/spec.json)
You have to have bytecode of contract where the same master of ceremony address is already hardcoded into the bytecode
- `engine_signer` address of master of ceremony
- `base_path` - folder where parity will store all data(blockchain, keys, etc)
- make sure in the `test_feofan` folder you have `keys/spec.json:name_property/` all the keys in JSON store format that are defined in
[adderesses.js](addresses.js) file
- `password` - location of file where there is password for your accounts in plain text format

2. Run master of ceremony node with masterOfceremony unlocked + all initial keys:
 ```bash
 parity --config node.toml --unlock 0x0039F22efB07A647557C7C5d17854CFD6D489eF3,0x030B90762Cee7a87ee4f51e715a302177043835e,0x4c718e4FdD135Db0Ddcf1c9421077edaF336e593,0x798a19fa3Ea264286A9C27353ECAe89872f46C7E --nat=none --no-ui
 ```
- 2.1. When you started the node, please copy and save enode's URL into the `second_reserved_peers` file. Example 
[parity_setup/second_reserved_peers](parity_setup/second_reserved_peers):
```
2017-12-14 14:26:12  Public node URL: enode://e8bba2865c02886ca182a51d711343607dba9a8903255650501466fdc3c7c7481428d78334babad3f181704b657be311ee90893a27d9cd93e0cbacfa9f7a21bb@[::0.0.1.0]:30305
```

3. Deploy all contract using [../migrations/2_deploy_contract.js]([../migrations/2_deploy_contract.js]) file:
```bash
POA_NETWORK_CONSENSUS_ADDRESS=0xf472e0e43570b9afaab67089615080cf7c20018d MASTER_OF_CEREMONY=0x0039F22efB07A647557C7C5d17854CFD6D489eF3 ./node_modules/.bin/truffle migrate --reset --network sokol
```

4. Open [addresses.js](addresses.js) and modify masterOfCeremony and keysManager addresses.

5. Run 
`PORT=8545 UNLOCKED_ADDRESS=0x0039F22efB07A647557C7C5d17854CFD6D489eF3 node test-poa-setup.js` from `scripts` folder
If all went succesfully, you should see status for `Initial Key` and `CreateKeys` as `0x1` if the status is `0x0` that means something went wrong
OR
you are trying to initialize already initialized key
You should also see logs from masterOfCeremony node's after `createKeys` was succesfully executed:
```
017-12-14 14:45:45  Signal for transition within contract. New list: [0039f22efb07a647557c7c5d17854cfd6d489ef3, ab315d6227ad46cc05a60e2c89919ce9d93ebe32]
2017-12-14 14:45:45  Applying validator set change signalled at block 38
```

6. Now, when you are ready to start your second node, make sure you have correct toml file. Example secondMiner.toml
```bash
# AlphaTestTestNet branch
[parity]
chain = "spec.json"
base_path = "test_feofan2"
[network]
port = 30307
discovery=true
reserved_only = false
reserved_peers = "./second_reserved_peers"
[rpc]
cors = "all"
interface = "all"
hosts = ["all"]
port = 8549
apis = ["web3", "eth", "net", "parity", "traces", "rpc", "secretstore"]
[websockets]
disable = false
port = 8542
interface = "all"
origins = ["all"]
apis = ["web3", "eth", "net", "parity", "traces", "rpc", "secretstore"]
hosts = ["all"]
[footprint]
tracing = "on"
pruning = "archive"
fat_db = "on"
[account]
password = ["password"]
#unlock =["0x0039F22efB07A647557C7C5d17854CFD6D489eF3,0x030B90762Cee7a87ee4f51e715a302177043835e,0x4c718e4FdD135Db0Ddcf1c9421077edaF336e593,0x798a19fa3Ea264286A9C27353ECAe89872f46C7E"]
[mining]
force_sealing = true
engine_signer = "0xAB315D6227AD46cC05a60E2c89919cE9d93EBE32"
reseal_on_txs = "none"
```

Notice the difference in the following fields:
- `engine_signer` - address of secondMiner.mining key
- `base_path` should be different folder other than masterOfCeremony toml's file config
- `[network]port` - network port. Can be the same if ran on different machine. Must be different if ran on the same machine.
- `[rpc]port` - rpc port. Can be the same if ran on different machine. Must be different if ran on the same machine.
- `[websockets]port` - websockets port. Can be the same if ran on different machine. Must be different if ran on the same machine.
- `reserved_peers` = "./second_reserved_peers" - notice that masterofceremony node doesn't have it because it is the first node to start the network.
Second Node has to know where to sync blockchain from, so the address should be located in the file

7. Run 
```
parity --config secondMiner.toml --nat=none ui
```
8. Go to Contract > +Watch > Enter Address and ABI for KeysManager contract
9. Verify that everything is correct
10. Now you are all done. You should see that 2 miners organized PoA consensus and both should mine the blockchain.
Feel free to add as many nodes as you want using this setup.

# Cleanup

If you want to start everything from scratch, just go to each miner's folder and remove everything except keys folder.
```bash
cd test_feofan
rm -rf cache chains dapps network signer
rm -rf keys/OraclesPoA/address_book.json
```

# How to generate bytecode for spec.json consensus contract
Please refer to README.md of root repo's folder for instructions