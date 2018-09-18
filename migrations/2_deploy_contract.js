const fs = require('fs');
const moment = require('moment');
const PoaNetworkConsensus = artifacts.require("./PoaNetworkConsensus.sol");
const ProxyStorage = artifacts.require("./ProxyStorage.sol");
const KeysManager = artifacts.require("./KeysManager.sol");
const BallotsStorage = artifacts.require("./BallotsStorage.sol");
const ValidatorMetadata = artifacts.require("./ValidatorMetadata.sol");
const VotingToChangeKeys = artifacts.require("./VotingToChangeKeys");
const VotingToChangeMinThreshold = artifacts.require("./VotingToChangeMinThreshold");
const VotingToChangeProxyAddress = artifacts.require("./VotingToChangeProxyAddress");
const VotingToManageEmissionFunds = artifacts.require("./VotingToManageEmissionFunds");
const RewardByBlock = artifacts.require("./RewardByBlock");
const EmissionFunds = artifacts.require("./EmissionFunds");
const EternalStorageProxy = artifacts.require("./eternal-storage/EternalStorageProxy.sol");

module.exports = function(deployer, network, accounts) {
  if (network === 'sokol') {
    let masterOfCeremony = process.env.MASTER_OF_CEREMONY;
    let poaNetworkConsensusAddress = process.env.POA_NETWORK_CONSENSUS_ADDRESS;
    let previousKeysManager = process.env.OLD_KEYSMANAGER || "0x0000000000000000000000000000000000000000";
    let demoMode = !!process.env.DEMO === true;
    let poaNetworkConsensus, emissionFunds;
    let proxyStorage, proxyStorageImplAddress;
    let keysManager, keysManagerImplAddress;
    let ballotsStorage, ballotsStorageImplAddress;
    let validatorMetadata, validatorMetadataImplAddress;
    let votingToChangeKeys, votingToChangeKeysImplAddress;
    let votingToChangeMinThreshold, votingToChangeMinThresholdImplAddress;
    let votingToChangeProxyAddress, votingToChangeProxyAddressImplAddress;
    let votingToManageEmissionFunds, votingToManageEmissionFundsImplAddress;
    let rewardByBlock, rewardByBlockImplAddress;

    const minBallotDuration = demoMode ? 0 : 172800;

    deployer.then(async function() {
      if (!!process.env.DEPLOY_POA === true) {
        let validators = [];

        if (poaNetworkConsensusAddress) {
          poaNetworkConsensus = PoaNetworkConsensus.at(poaNetworkConsensusAddress);
          validators = await poaNetworkConsensus.getValidators.call();
          const mocIndex = validators.indexOf(masterOfCeremony.toLowerCase())
          if (mocIndex > -1) {
            validators.splice(mocIndex, 1);
          }
        }

        poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, validators);
        poaNetworkConsensusAddress = poaNetworkConsensus.address;
      } else {
        poaNetworkConsensus = PoaNetworkConsensus.at(poaNetworkConsensusAddress);
      }

      // Deploy ProxyStorage
      proxyStorage = await ProxyStorage.new();
      proxyStorageImplAddress = proxyStorage.address;
      proxyStorage = await EternalStorageProxy.new(
        "0x0000000000000000000000000000000000000000",
        proxyStorageImplAddress
      );
      proxyStorage = ProxyStorage.at(proxyStorage.address);
      await proxyStorage.init(poaNetworkConsensusAddress);
      await poaNetworkConsensus.setProxyStorage(proxyStorage.address);

      // Deploy KeysManager
      keysManager = await KeysManager.new();
      keysManagerImplAddress = keysManager.address;
      keysManager = await EternalStorageProxy.new(
        proxyStorage.address,
        keysManagerImplAddress
      );
      keysManager = KeysManager.at(keysManager.address);
      await keysManager.init(previousKeysManager);
      
      // Deploy BallotsStorage
      ballotsStorage = await BallotsStorage.new();
      ballotsStorageImplAddress = ballotsStorage.address;
      ballotsStorage = await EternalStorageProxy.new(
        proxyStorage.address,
        ballotsStorageImplAddress
      );
      ballotsStorage = BallotsStorage.at(ballotsStorage.address);
      if (demoMode) {
        await ballotsStorage.init([1, 1]);
      } else {
        await ballotsStorage.init([3, 2]);
      }

      // Deploy ValidatorMetadata
      validatorMetadata = await ValidatorMetadata.new();
      validatorMetadataImplAddress = validatorMetadata.address;
      validatorMetadata = await EternalStorageProxy.new(
        proxyStorage.address,
        validatorMetadataImplAddress
      );
      validatorMetadata = ValidatorMetadata.at(validatorMetadata.address);

      // Deploy VotingToChangeKeys
      votingToChangeKeys = await VotingToChangeKeys.new();
      votingToChangeKeysImplAddress = votingToChangeKeys.address;
      votingToChangeKeys = await EternalStorageProxy.new(
        proxyStorage.address,
        votingToChangeKeysImplAddress
      );
      votingToChangeKeys = VotingToChangeKeys.at(votingToChangeKeys.address);
      await votingToChangeKeys.init(minBallotDuration);
      await votingToChangeKeys.migrateDisable();

      // Deploy VotingToChangeMinThreshold
      votingToChangeMinThreshold = await VotingToChangeMinThreshold.new();
      votingToChangeMinThresholdImplAddress = votingToChangeMinThreshold.address;
      votingToChangeMinThreshold = await EternalStorageProxy.new(
        proxyStorage.address,
        votingToChangeMinThresholdImplAddress
      );
      votingToChangeMinThreshold = VotingToChangeMinThreshold.at(
        votingToChangeMinThreshold.address
      );
      await votingToChangeMinThreshold.init(minBallotDuration, demoMode ? 1 : 3);
      await votingToChangeMinThreshold.migrateDisable();

      // Deploy VotingToChangeProxyAddress
      votingToChangeProxyAddress = await VotingToChangeProxyAddress.new();
      votingToChangeProxyAddressImplAddress = votingToChangeProxyAddress.address;
      votingToChangeProxyAddress = await EternalStorageProxy.new(
        proxyStorage.address,
        votingToChangeProxyAddressImplAddress
      );
      votingToChangeProxyAddress = VotingToChangeProxyAddress.at(
        votingToChangeProxyAddress.address
      );
      await votingToChangeProxyAddress.init(minBallotDuration);
      await votingToChangeProxyAddress.migrateDisable();

      // Deploy VotingToManageEmissionFunds
      votingToManageEmissionFunds = await VotingToManageEmissionFunds.new();
      votingToManageEmissionFundsImplAddress = votingToManageEmissionFunds.address;
      votingToManageEmissionFunds = await EternalStorageProxy.new(
        proxyStorage.address,
        votingToManageEmissionFundsImplAddress
      );
      votingToManageEmissionFunds = VotingToManageEmissionFunds.at(
        votingToManageEmissionFunds.address
      );

      // Deploy EmissionFunds
      emissionFunds = await EmissionFunds.new(votingToManageEmissionFunds.address);

      // Deploy RewardByBlock
      rewardByBlock = await RewardByBlock.new();
      rewardByBlockImplAddress = rewardByBlock.address;
      rewardByBlock = await EternalStorageProxy.new(
        proxyStorage.address,
        rewardByBlockImplAddress
      );
      rewardByBlock = RewardByBlock.at(
        rewardByBlock.address
      );

      // Initialize VotingToManageEmissionFunds
      await votingToManageEmissionFunds.init(
        demoMode ? moment.utc().add(10, 'minutes').unix() : moment.utc().add(3, 'months').unix(),
        demoMode ? 3600 : 7776000, // emissionReleaseThreshold: 1 hour for demo, 3 months for production
        demoMode ? 1500 : 604800, // distributionThreshold: 25 minutes for demo, 7 days for production
        emissionFunds.address
      );

      // Initialize ProxyStorage
      await proxyStorage.initializeAddresses(
        keysManager.address,
        votingToChangeKeys.address,
        votingToChangeMinThreshold.address,
        votingToChangeProxyAddress.address,
        votingToManageEmissionFunds.address,
        ballotsStorage.address,
        validatorMetadata.address,
        rewardByBlock.address
      );

      if (!!process.env.SAVE_TO_FILE === true) {
        const contracts = {
          "VOTING_TO_CHANGE_KEYS_ADDRESS": votingToChangeKeys.address,
          "VOTING_TO_CHANGE_MIN_THRESHOLD_ADDRESS": votingToChangeMinThreshold.address,
          "VOTING_TO_CHANGE_PROXY_ADDRESS": votingToChangeProxyAddress.address,
          "VOTING_TO_MANAGE_EMISSION_FUNDS_ADDRESS": votingToManageEmissionFunds.address,
          "BALLOTS_STORAGE_ADDRESS": ballotsStorage.address,
          "KEYS_MANAGER_ADDRESS": keysManager.address,
          "METADATA_ADDRESS": validatorMetadata.address,
          "PROXY_ADDRESS": proxyStorage.address,
          "POA_ADDRESS": poaNetworkConsensusAddress,
          "EMISSION_FUNDS_ADDRESS": emissionFunds.address,
          "REWARD_BY_BLOCK_ADDRESS": rewardByBlock.address
        };

        fs.writeFileSync('./contracts.json', JSON.stringify(contracts, null, 2));
      }

      console.log(
        '\nDone. ADDRESSES:',
        `
  VotingToChangeKeys.address (implementation) ........ ${votingToChangeKeysImplAddress}
  VotingToChangeKeys.address (storage) ............... ${votingToChangeKeys.address}
  VotingToChangeMinThreshold.address (implementation). ${votingToChangeMinThresholdImplAddress}
  VotingToChangeMinThreshold.address (storage) ....... ${votingToChangeMinThreshold.address}
  VotingToChangeProxyAddress.address (implementation). ${votingToChangeProxyAddressImplAddress}
  VotingToChangeProxyAddress.address (storage) ....... ${votingToChangeProxyAddress.address}
  VotingToManageEmissionFunds.address (implementation) ${votingToManageEmissionFundsImplAddress}
  VotingToManageEmissionFunds.address (storage) ...... ${votingToManageEmissionFunds.address}
  BallotsStorage.address (implementation) ............ ${ballotsStorageImplAddress}
  BallotsStorage.address (storage) ................... ${ballotsStorage.address}
  KeysManager.address (implementation) ............... ${keysManagerImplAddress}
  KeysManager.address (storage) ...................... ${keysManager.address}
  ValidatorMetadata.address (implementation) ......... ${validatorMetadataImplAddress}
  ValidatorMetadata.address (storage) ................ ${validatorMetadata.address}
  ProxyStorage.address (implementation) .............. ${proxyStorageImplAddress}
  ProxyStorage.address (storage) ..................... ${proxyStorage.address}
  PoaNetworkConsensus.address ........................ ${poaNetworkConsensusAddress}
  EmissionFunds.address .............................. ${emissionFunds.address}
  RewardByBlock.address (implementation) .............. ${rewardByBlockImplAddress}
  RewardByBlock.address (storage) ..................... ${rewardByBlock.address}
        `
      );
    }).catch(function(error) {
      console.error(error);
    });
  }
};

// SAVE_TO_FILE=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
// SAVE_TO_FILE=true DEPLOY_POA=true POA_NETWORK_CONSENSUS_ADDRESS=0x8bf38d4764929064f2d4d3a56520a76ab3df415b MASTER_OF_CEREMONY=0xCf260eA317555637C55F70e55dbA8D5ad8414Cb0 OLD_KEYSMANAGER=0xfc90125492e58dbfe80c0bfb6a2a759c4f703ca8 ./node_modules/.bin/truffle migrate --reset --network sokol
