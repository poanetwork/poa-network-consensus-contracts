var PoaNetworkConsensus = artifacts.require("./PoaNetworkConsensus.sol");
var ProxyStorage = artifacts.require("./ProxyStorage.sol");
var KeysManager = artifacts.require("./KeysManager.sol");
var BallotsStorage = artifacts.require("./BallotsStorage.sol");
var ValidatorMetadata = artifacts.require("./ValidatorMetadata.sol");
let VotingToChangeKeys = artifacts.require('./mockContracts/VotingToChangeKeys');
let VotingToChangeMinThreshold = artifacts.require('./mockContracts/VotingToChangeMinThreshold');
let VotingToChangeProxyAddress = artifacts.require('./mockContracts/VotingToChangeProxyAddress');

module.exports = async function(deployer, network, accounts) {
  let masterOfCeremony = process.env.MASTER_OF_CEREMONY;
  let poaNetworkConsensusAddress = process.env.POA_NETWORK_CONSENSUS_ADDRESS;
  if(network === 'sokol'){
    poaNetworkConsensus = await PoaNetworkConsensus.at(poaNetworkConsensusAddress);
    await deployer.deploy(ProxyStorage, poaNetworkConsensusAddress, masterOfCeremony);
    await poaNetworkConsensus.setProxyStorage(ProxyStorage.address);
    await deployer.deploy(KeysManager, ProxyStorage.address, poaNetworkConsensusAddress, masterOfCeremony);
    await deployer.deploy(BallotsStorage, ProxyStorage.address);
    await deployer.deploy(ValidatorMetadata, ProxyStorage.address);
    await deployer.deploy(VotingToChangeKeys, ProxyStorage.address);
    await deployer.deploy(VotingToChangeMinThreshold, ProxyStorage.address);
    await deployer.deploy(VotingToChangeProxyAddress, ProxyStorage.address);
    let proxyStorage = await ProxyStorage.deployed();
    await proxyStorage.initializeAddresses(KeysManager.address,
      VotingToChangeKeys.address,
      VotingToChangeMinThreshold.address,
      VotingToChangeProxyAddress.address,
      BallotsStorage.address)
    console.log('Done')
    console.log('ADDRESSES:\n', 
    `VotingToChangeKeys.address ${VotingToChangeKeys.address} \n
    VotingToChangeMinThreshold.address ${VotingToChangeMinThreshold.address} \n
    VotingToChangeProxyAddress.address ${VotingToChangeProxyAddress.address} \n
    BallotsStorage.address ${BallotsStorage.address} \n
    KeysManager.address ${KeysManager.address} \n
    ValidatorMetadata.address ${ValidatorMetadata.address} \n
    `)

    // let initialKey = '0x030b90762cee7a87ee4f51e715a302177043835e';
    // let keysManager = await KeysManager.at('0x758492834ed6454f41d6d3d6b73d6e46d4555429');
    // await keysManager.initiateKeys(initialKey);
    // await keysManager.initiateKeys('0x90B3E2dA7217144E34028FD7f4700a9Cb254f079');
  }
};
