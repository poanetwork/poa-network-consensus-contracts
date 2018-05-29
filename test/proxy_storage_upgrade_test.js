let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let KeysManager = artifacts.require('./mockContracts/KeysManagerMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let ProxyStorageNew = artifacts.require('./upgradeContracts/ProxyStorageNew');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
let BallotsStorage = artifacts.require('./BallotsStorage');
let VotingToChangeKeys = artifacts.require('./VotingToChangeKeys');
let VotingToChangeMinThreshold = artifacts.require('./VotingToChangeMinThreshold');
let VotingToChangeProxy = artifacts.require('./VotingToChangeProxyAddress');
let EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let masterOfCeremony;
let keysManager, keysManagerEternalStorage;
let proxyStorage, proxyStorageEternalStorage;
let validatorMetadata, validatorMetadataEternalStorage;
let ballotsStorage, ballotsEternalStorage;
let votingToChangeKeys, votingToChangeKeysEternalStorage;
let votingToChangeMinThreshold, votingToChangeMinThresholdEternalStorage;
let votingToChangeProxy, votingToChangeProxyEternalStorage;
contract('ProxyStorage upgraded [all features]', function (accounts) {
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    
    proxyStorage = await ProxyStorageMock.new();
    proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorage.address);
    proxyStorage = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorage.init(poaNetworkConsensus.address).should.be.fulfilled;
    (await proxyStorageEternalStorage.getProxyStorage.call()).should.be.equal(
      proxyStorageEternalStorage.address
    );

    const proxyStorageNew = await ProxyStorageNew.new();
    await proxyStorageEternalStorage.setProxyStorage(accounts[6]);
    await proxyStorageEternalStorage.upgradeTo(proxyStorageNew.address, {from: accounts[6]});
    await proxyStorageEternalStorage.setProxyStorage(proxyStorageEternalStorage.address);
    proxyStorage = await ProxyStorageNew.at(proxyStorageEternalStorage.address);

	keysManager = await KeysManager.new();
    keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorage.address, keysManager.address);
    keysManager = await KeysManager.at(keysManagerEternalStorage.address);

    validatorMetadata = await ValidatorMetadata.new();
    validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);
    
    ballotsStorage = await BallotsStorage.new();
    ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);

    votingToChangeKeys = await VotingToChangeKeys.new();
    votingToChangeKeysEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingToChangeKeys.address);

    votingToChangeMinThreshold = await VotingToChangeMinThreshold.new();
    votingToChangeMinThresholdEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingToChangeMinThreshold.address);

    votingToChangeProxy = await VotingToChangeProxy.new();
    votingToChangeProxyEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingToChangeProxy.address);
  })
  describe('#constructor', async () => {
    it('sets MoC and Poa', async () => {
      poaNetworkConsensus.address.should.be.equal(
        await proxyStorage.getPoaConsensus.call()
      );
      true.should.be.equal(
        await proxyStorage.isValidator.call(masterOfCeremony)
      );
    })
  })
  describe('#initializeAddresses', async () => {
    it('sets all addresses', async () => {
      await proxyStorage.initializeAddresses(
        keysManagerEternalStorage.address,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxyEternalStorage.address,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await proxyStorage.initializeAddresses(
        keysManagerEternalStorage.address,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxyEternalStorage.address,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
      ).should.be.fulfilled;
      keysManagerEternalStorage.address.should.be.equal(
        await proxyStorage.getKeysManager.call()
      );
      votingToChangeKeysEternalStorage.address.should.be.equal(
        await proxyStorage.getVotingToChangeKeys.call()
      );
      votingToChangeMinThresholdEternalStorage.address.should.be.equal(
        await proxyStorage.getVotingToChangeMinThreshold.call()
      );
      votingToChangeProxyEternalStorage.address.should.be.equal(
        await proxyStorage.getVotingToChangeProxy.call()
      );
      ballotsEternalStorage.address.should.be.equal(
        await proxyStorage.getBallotsStorage.call()
      );
      validatorMetadataEternalStorage.address.should.be.equal(
        await proxyStorage.getValidatorMetadata.call()
      );
      logs[0].event.should.be.equal('ProxyInitialized');
      logs[0].args.keysManagerEternalStorage.should.be.equal(keysManagerEternalStorage.address);
      logs[0].args.votingToChangeKeysEternalStorage.should.be.equal(votingToChangeKeysEternalStorage.address);
      logs[0].args.votingToChangeMinThresholdEternalStorage.should.be.equal(votingToChangeMinThresholdEternalStorage.address);
      logs[0].args.votingToChangeProxyEternalStorage.should.be.equal(votingToChangeProxyEternalStorage.address);
      logs[0].args.ballotsStorageEternalStorage.should.be.equal(ballotsEternalStorage.address);
      logs[0].args.validatorMetadataEternalStorage.should.be.equal(validatorMetadataEternalStorage.address);
    })
    it('prevents Moc to call it more than once', async () => {
      false.should.be.equal(await proxyStorage.mocInitialized.call());
      const {logs} = await proxyStorage.initializeAddresses(
        keysManagerEternalStorage.address,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxyEternalStorage.address,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address
      ).should.be.fulfilled;
      true.should.be.equal(await proxyStorage.mocInitialized.call());
      await proxyStorage.initializeAddresses(
        keysManagerEternalStorage.address,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxyEternalStorage.address,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address
      ).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#setContractAddress', async () => {
    beforeEach(async () => {
      await proxyStorage.initializeAddresses(
        keysManagerEternalStorage.address,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxyEternalStorage.address,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
        {from: masterOfCeremony}
      ).should.be.fulfilled;
    })
    it('can only be called from votingToChangeProxy address', async () => {
      await proxyStorage.setContractAddress(1, accounts[2], {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(1, accounts[2], {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
    })
    it('cannot be set to 0x0 address', async () => {
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(1, '0x0000000000000000000000000000000000000000', {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
    })
    it('sets keysManager', async () => {
      let keysManagerNew = await KeysManager.new();
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(1, keysManagerNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      let eternalProxyAddress = await proxyStorage.getKeysManager.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      keysManagerNew.address.should.be.equal(
        await eternalProxy.implementation.call()
      );
    })
    it('sets votingToChangeKeys', async () => {
      let votingToChangeKeysNew = await VotingToChangeKeys.new();
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(2, votingToChangeKeysNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      let eternalProxyAddress = await proxyStorage.getVotingToChangeKeys.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      votingToChangeKeysNew.address.should.be.equal(
        await eternalProxy.implementation.call()
      )
    })
    it('sets votingToChangeMinThreshold', async () => {
      let votingToChangeMinThresholdNew = await VotingToChangeMinThreshold.new();
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(3, votingToChangeMinThresholdNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      let eternalProxyAddress = await proxyStorage.getVotingToChangeMinThreshold.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      votingToChangeMinThresholdNew.address.should.be.equal(
        await eternalProxy.implementation.call()
      )
    })
    //it('sets votingToChangeProxy', async () => {
    //  see voting_to_change_proxy_test.js
    //})
    it('sets ballotsStorage', async () => {
      let ballotsStorageNew = await BallotsStorage.new();

      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(5, ballotsStorageNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      let eternalProxyAddress = await proxyStorage.getBallotsStorage.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      ballotsStorageNew.address.should.be.equal(
        await eternalProxy.implementation.call()
      )
    })
    it('sets poaConsensus', async () => {
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(6, accounts[5], {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      accounts[5].should.be.equal(
        await proxyStorage.getPoaConsensus.call()
      )
    })
    it('sets validatorMetadata', async () => {
      let validatorMetadataNew = await ValidatorMetadata.new();
      
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(7, validatorMetadataNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      let eternalProxyAddress = await proxyStorage.getValidatorMetadata.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      validatorMetadataNew.address.should.be.equal(
        await eternalProxy.implementation.call()
      )
    })
    it('changes proxyStorage (itself) implementation', async () => {
      const oldVersion = await proxyStorage.version.call();
      const newVersion = oldVersion.add(1);
      let proxyStorageNew = await ProxyStorageMock.new();
      await proxyStorage.setVotingToChangeProxyMock(accounts[4]);
      await proxyStorage.setContractAddress(8, proxyStorageNew.address, {from: accounts[4]}).should.be.fulfilled;
      await proxyStorage.setVotingToChangeProxyMock(votingToChangeProxyEternalStorage.address);
      
      proxyStorageNew.address.should.be.equal(
        await proxyStorageEternalStorage.implementation.call()
      );
      proxyStorageNew.address.should.be.equal(
        await proxyStorage.implementation.call()
      );
      newVersion.should.be.bignumber.equal(
        await proxyStorageEternalStorage.version.call()
      );
      proxyStorageNew = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
      newVersion.should.be.bignumber.equal(
        await proxyStorageNew.version.call()
      );
    })
  })
})
