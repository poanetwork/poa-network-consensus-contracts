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

module.exports = function(deployer, network, accounts) {
  if (network === 'sokol') {
    let masterOfCeremony = process.env.MASTER_OF_CEREMONY;
    let poaNetworkConsensusAddress = process.env.POA_NETWORK_CONSENSUS_ADDRESS;
    let previousKeysManager = process.env.OLD_KEYSMANAGER || "0x0000000000000000000000000000000000000000";
    let demoMode = !!process.env.DEMO === true;
    let poaNetworkConsensus;
    let proxyStorage, proxyStorageImplAddress;
    let keysManager, keysManagerImplAddress;
    let ballotsStorage, ballotsStorageImplAddress;
    let validatorMetadata, validatorMetadataImplAddress;
    let votingToChangeKeys, votingToChangeKeysImplAddress;
    let votingToChangeMinThreshold, votingToChangeMinThresholdImplAddress;
    let votingToChangeProxyAddress, votingToChangeProxyAddressImplAddress;

    const minBallotDuration = demoMode ? 0 : 172800;

    try {
      deployer.then(function() {
        if (!!process.env.DEPLOY_POA === true) {
          poaNetworkConsensus = PoaNetworkConsensus.at(poaNetworkConsensusAddress);
          let validators = poaNetworkConsensus.getValidators.call();
          let moc = validators.indexOf(masterOfCeremony.toLowerCase())
          if (moc > -1) {
            validators.splice(moc, 1);
          }

          return PoaNetworkConsensus.new(masterOfCeremony, validators);
        }

        return PoaNetworkConsensus.at(poaNetworkConsensusAddress);
      }).then(function(instance) {
        poaNetworkConsensus = instance;
        if (!!process.env.DEPLOY_POA === true) {
          console.log(poaNetworkConsensus.address);
        }
        poaNetworkConsensusAddress = poaNetworkConsensus.address;

        return ProxyStorage.new();
      }).then(function(instance) {
        proxyStorageImplAddress = instance.address;
        return EternalStorageProxy.new(
          "0x0000000000000000000000000000000000000000",
          instance.address
        );
      }).then(function(instance) {
        proxyStorage = ProxyStorage.at(instance.address);
        return proxyStorage.init(poaNetworkConsensusAddress);
      }).then(function() {
        return KeysManager.new();
      }).then(function(instance) {
        keysManagerImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        keysManager = KeysManager.at(instance.address);
        return keysManager.init(previousKeysManager);
      }).then(function() {
        return BallotsStorage.new();
      }).then(function(instance) {
        ballotsStorageImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        ballotsStorage = BallotsStorage.at(instance.address);
        if (demoMode) {
          return ballotsStorage.init([1, 1]);
        } else {
          return ballotsStorage.init([3, 2]);
        }
      }).then(function() {
        return ValidatorMetadata.new();
      }).then(function(instance) {
        validatorMetadataImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        validatorMetadata = ValidatorMetadata.at(instance.address);
        return VotingToChangeKeys.new();
      }).then(function(instance) {
        votingToChangeKeysImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        votingToChangeKeys = VotingToChangeKeys.at(instance.address);
        return votingToChangeKeys.init(minBallotDuration);
      }).then(function() {
        return VotingToChangeMinThreshold.new();
      }).then(function(instance) {
        votingToChangeMinThresholdImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        votingToChangeMinThreshold = VotingToChangeMinThreshold.at(instance.address);
        return votingToChangeMinThreshold.init(minBallotDuration, demoMode ? 1 : 3);
      }).then(function() {
        return VotingToChangeProxyAddress.new();
      }).then(function(instance) {
        votingToChangeProxyAddressImplAddress = instance.address;
        return EternalStorageProxy.new(proxyStorage.address, instance.address);
      }).then(function(instance) {
        votingToChangeProxyAddress = VotingToChangeProxyAddress.at(instance.address);
        return votingToChangeProxyAddress.init(minBallotDuration);
      }).then(function() {
        return proxyStorage.initializeAddresses(
          keysManager.address,
          votingToChangeKeys.address,
          votingToChangeMinThreshold.address,
          votingToChangeProxyAddress.address,
          ballotsStorage.address,
          validatorMetadata.address
        );
      }).then(function() {
        return poaNetworkConsensus.setProxyStorage(proxyStorage.address);
      }).then(function() {
        if (!!process.env.SAVE_TO_FILE === true) {
          const contracts = {
            "VOTING_TO_CHANGE_KEYS_ADDRESS": votingToChangeKeys.address,
            "VOTING_TO_CHANGE_MIN_THRESHOLD_ADDRESS": votingToChangeMinThreshold.address,
            "VOTING_TO_CHANGE_PROXY_ADDRESS": votingToChangeProxyAddress.address,
            "BALLOTS_STORAGE_ADDRESS": ballotsStorage.address,
            "KEYS_MANAGER_ADDRESS": keysManager.address,
            "METADATA_ADDRESS": validatorMetadata.address,
            "PROXY_ADDRESS": proxyStorage.address
          };

          fs.writeFileSync('./contracts.json', JSON.stringify(contracts, null, 2));
        }

        console.log('Done')
        console.log(
          'ADDRESSES:',
          `
  VotingToChangeKeys.address (implementation) ${votingToChangeKeysImplAddress} \n
  VotingToChangeKeys.address (storage) ${votingToChangeKeys.address} \n
  VotingToChangeMinThreshold.address (implementation) ${votingToChangeMinThresholdImplAddress} \n
  VotingToChangeMinThreshold.address (storage) ${votingToChangeMinThreshold.address} \n
  VotingToChangeProxyAddress.address (implementation) ${votingToChangeProxyAddressImplAddress} \n
  VotingToChangeProxyAddress.address (storage) ${votingToChangeProxyAddress.address} \n
  BallotsStorage.address (implementation) ${ballotsStorageImplAddress} \n
  BallotsStorage.address (storage) ${ballotsStorage.address} \n
  KeysManager.address (implementation) ${keysManagerImplAddress} \n
  KeysManager.address (storage) ${keysManager.address} \n
  ValidatorMetadata.address (implementation) ${validatorMetadataImplAddress} \n
  ValidatorMetadata.address (storage) ${validatorMetadata.address} \n
  ProxyStorage.address (implementation) ${proxyStorageImplAddress} \n
  ProxyStorage.address (storage) ${proxyStorage.address} \n
          `
        );
      });
    } catch (error) {
      console.error(error);
    }
  }
};

// SAVE_TO_FILE=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
// SAVE_TO_FILE=true DEPLOY_POA=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
