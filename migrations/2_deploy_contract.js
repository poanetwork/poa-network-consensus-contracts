const fs = require('fs');
const PoaNetworkConsensus = artifacts.require("./PoaNetworkConsensus.sol");
const ProxyStorage = artifacts.require("./ProxyStorage.sol");
const KeysManager = artifacts.require("./KeysManager.sol");
const BallotsStorage = artifacts.require("./BallotsStorage.sol");
const ValidatorMetadata = artifacts.require("./ValidatorMetadata.sol");
const VotingToChangeKeys = artifacts.require("./VotingToChangeKeys");
const VotingToChangeMinThreshold = artifacts.require("./VotingToChangeMinThreshold");
const VotingToChangeProxyAddress = artifacts.require("./VotingToChangeProxyAddress");
const EternalStorageProxy = artifacts.require("./eternal-storage/EternalStorageProxy.sol");

module.exports = async function(deployer, network, accounts) {
  let masterOfCeremony = process.env.MASTER_OF_CEREMONY;
  let poaNetworkConsensusAddress = process.env.POA_NETWORK_CONSENSUS_ADDRESS;
  let previousKeysManager = process.env.OLD_KEYSMANAGER || "0x0000000000000000000000000000000000000000";
  let poaNetworkConsensus;
  if (!!process.env.DEPLOY_POA === true && network === 'sokol') {
    poaNetworkConsensus = await PoaNetworkConsensus.at(poaNetworkConsensusAddress);
    let validators = await poaNetworkConsensus.getValidators();
    let moc = validators.indexOf(masterOfCeremony.toLowerCase())
    if (moc > -1) {
      validators.splice(moc, 1);
    }
    poaNetworkConsensus = await deployer.deploy(PoaNetworkConsensus, masterOfCeremony, validators);
    console.log(PoaNetworkConsensus.address)
    poaNetworkConsensusAddress = PoaNetworkConsensus.address
  }
  if (network === 'sokol') {
    let demoMode = !!process.env.DEMO === true;
    try {
      poaNetworkConsensus = poaNetworkConsensus || await PoaNetworkConsensus.at(poaNetworkConsensusAddress);
      
      await deployer.deploy(ProxyStorage);
      await deployer.deploy(
        EternalStorageProxy,
        "0x0000000000000000000000000000000000000000",
        ProxyStorage.address
      );
      const proxyStorageEternalStorageAddress = EternalStorageProxy.address;
      const proxyStorage = await ProxyStorage.at(proxyStorageEternalStorageAddress);
      await proxyStorage.init(poaNetworkConsensusAddress);
      
      await deployer.deploy(KeysManager);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, KeysManager.address);
      const keysManagerEternalStorageAddress = EternalStorageProxy.address;
      const keysManager = await KeysManager.at(keysManagerEternalStorageAddress);
      await keysManager.init(previousKeysManager);
      
      await deployer.deploy(BallotsStorage);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, BallotsStorage.address);
      const ballotsStorageEternalStorageAddress = EternalStorageProxy.address;
      const ballotsStorage = await BallotsStorage.at(ballotsStorageEternalStorageAddress);
      if (demoMode) {
        await ballotsStorage.init([1, 1]);
      } else {
        await ballotsStorage.init([3, 2]);
      }
      
      await deployer.deploy(ValidatorMetadata);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, ValidatorMetadata.address);
      const validatorMetadataEternalStorageAddress = EternalStorageProxy.address;
      
      await deployer.deploy(VotingToChangeKeys);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, VotingToChangeKeys.address);
      const votingToChangeKeysEternalStorageAddress = EternalStorageProxy.address;
      const votingToChangeKeys = await VotingToChangeKeys.at(votingToChangeKeysEternalStorageAddress);
      await votingToChangeKeys.init(demoMode ? 0 : 172800);
      
      await deployer.deploy(VotingToChangeMinThreshold);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, VotingToChangeMinThreshold.address);
      const votingToChangeMinThresholdEternalStorageAddress = EternalStorageProxy.address;
      const votingToChangeMinThreshold = await VotingToChangeMinThreshold.at(votingToChangeMinThresholdEternalStorageAddress);
      await votingToChangeMinThreshold.init(demoMode ? 0 : 172800, demoMode ? 1 : 3);

      await deployer.deploy(VotingToChangeProxyAddress);
      await deployer.deploy(EternalStorageProxy, proxyStorage.address, VotingToChangeProxyAddress.address);
      const votingToChangeProxyAddressEternalStorageAddress = EternalStorageProxy.address;
      const votingToChangeProxyAddress = await VotingToChangeProxyAddress.at(votingToChangeProxyAddressEternalStorageAddress);
      await votingToChangeProxyAddress.init(demoMode ? 0 : 172800);

      await proxyStorage.initializeAddresses(
        keysManagerEternalStorageAddress,
        votingToChangeKeysEternalStorageAddress,
        votingToChangeMinThresholdEternalStorageAddress,
        votingToChangeProxyAddressEternalStorageAddress,
        ballotsStorageEternalStorageAddress,
        validatorMetadataEternalStorageAddress
      );
      
      await poaNetworkConsensus.setProxyStorage(proxyStorage.address);

      if (!!process.env.SAVE_TO_FILE === true) {
        let contracts = {
          "VOTING_TO_CHANGE_KEYS_ADDRESS": votingToChangeKeysEternalStorageAddress,
          "VOTING_TO_CHANGE_MIN_THRESHOLD_ADDRESS": votingToChangeMinThresholdEternalStorageAddress,
          "VOTING_TO_CHANGE_PROXY_ADDRESS": votingToChangeProxyAddressEternalStorageAddress,
          "BALLOTS_STORAGE_ADDRESS": ballotsStorageEternalStorageAddress,
          "KEYS_MANAGER_ADDRESS": keysManagerEternalStorageAddress,
          "METADATA_ADDRESS": validatorMetadataEternalStorageAddress,
          "PROXY_ADDRESS": proxyStorageEternalStorageAddress
        }

        await saveToFile('./contracts.json', JSON.stringify(contracts, null, 2));
      }

      console.log('Done')
      console.log('ADDRESSES:\n', 
     `VotingToChangeKeys.address (implementation) ${VotingToChangeKeys.address} \n
      VotingToChangeKeys.address (storage) ${votingToChangeKeysEternalStorageAddress} \n
      VotingToChangeMinThreshold.address (implementation) ${VotingToChangeMinThreshold.address} \n
      VotingToChangeMinThreshold.address (storage) ${votingToChangeMinThresholdEternalStorageAddress} \n
      VotingToChangeProxyAddress.address (implementation) ${VotingToChangeProxyAddress.address} \n
      VotingToChangeProxyAddress.address (storage) ${votingToChangeProxyAddressEternalStorageAddress} \n
      BallotsStorage.address (implementation) ${BallotsStorage.address} \n
      BallotsStorage.address (storage) ${ballotsStorageEternalStorageAddress} \n
      KeysManager.address (implementation) ${KeysManager.address} \n
      KeysManager.address (storage) ${keysManagerEternalStorageAddress} \n
      ValidatorMetadata.address (implementation) ${ValidatorMetadata.address} \n
      ValidatorMetadata.address (storage) ${validatorMetadataEternalStorageAddress} \n
      ProxyStorage.address (implementation) ${ProxyStorage.address} \n
      ProxyStorage.address (storage) ${proxyStorageEternalStorageAddress} \n
      `)
      
    } catch (error) {
      console.error(error);
    }

  }
};

function saveToFile(filename, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, content, (err) => {
      console.log(err)
      if (err) reject(err);
      resolve();
    });
  });
}

// SAVE_TO_FILE=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
// SAVE_TO_FILE=true DEPLOY_POA=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
