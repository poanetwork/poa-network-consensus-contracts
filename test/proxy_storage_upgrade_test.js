let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let ProxyStorageNew = artifacts.require('./upgradeContracts/ProxyStorageNew');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
let BallotsStorage = artifacts.require('./BallotsStorage');
let VotingToChangeKeys = artifacts.require('./VotingToChangeKeys');
let VotingToChangeMinThreshold = artifacts.require('./VotingToChangeMinThreshold');
let EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let masterOfCeremony;
let proxyStorage, proxyStorageEternalStorage;
let validatorMetadata, validatorMetadataEternalStorage;
let ballotsStorage, ballotsEternalStorage;
let votingToChangeKeys, votingToChangeKeysEternalStorage;
let votingToChangeMinThreshold, votingToChangeMinThresholdEternalStorage;
contract('ProxyStorage upgraded [all features]', function (accounts) {
  let {
    keysManager,
    votingToChangeProxy
  } = {
    keysManager: accounts[1],
    votingToChangeProxy: accounts[4]
  }
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    
    proxyStorage = await ProxyStorageMock.new();
    proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorage.address);
    proxyStorage = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorage.init(poaNetworkConsensus.address).should.be.fulfilled;

    const proxyStorageNew = await ProxyStorageNew.new();
    await proxyStorageEternalStorage.setProxyStorage(accounts[6]);
    await proxyStorageEternalStorage.upgradeTo(proxyStorageNew.address, {from: accounts[6]});
    await proxyStorageEternalStorage.setProxyStorage(proxyStorageEternalStorage.address);
    proxyStorage = await ProxyStorageNew.at(proxyStorageEternalStorage.address);

    validatorMetadata = await ValidatorMetadata.new();
    validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);
    
    ballotsStorage = await BallotsStorage.new();
    ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);

    votingToChangeKeys = await VotingToChangeKeys.new();
    votingToChangeKeysEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingToChangeKeys.address);

    votingToChangeMinThreshold = await VotingToChangeMinThreshold.new();
    votingToChangeMinThresholdEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingToChangeMinThreshold.address);
  })
  describe('#constructor', async () => {
    it('sets MoC and Poa', async () => {
      poaNetworkConsensus.address.should.be.equal(
        await proxyStorage.getPoaConsensus()
      );
      true.should.be.equal(
        await proxyStorage.isValidator(masterOfCeremony)
      );
    })
  })
  describe('#initializeAddresses', async () => {
    it('sets all addresses', async () => {
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxy,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxy,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
      ).should.be.fulfilled;
      keysManager.should.be.equal(
        await proxyStorage.getKeysManager()
      );
      votingToChangeKeysEternalStorage.address.should.be.equal(
        await proxyStorage.getVotingToChangeKeys()
      );
      votingToChangeMinThresholdEternalStorage.address.should.be.equal(
        await proxyStorage.getVotingToChangeMinThreshold()
      );
      votingToChangeProxy.should.be.equal(
        await proxyStorage.getVotingToChangeProxy()
      );
      ballotsEternalStorage.address.should.be.equal(
        await proxyStorage.getBallotsStorage()
      );
      validatorMetadataEternalStorage.address.should.be.equal(
        await proxyStorage.getValidatorMetadata()
      );
      logs[0].event.should.be.equal('ProxyInitialized');
      logs[0].args.keysManager.should.be.equal(keysManager);
      logs[0].args.votingToChangeKeysEternalStorage.should.be.equal(votingToChangeKeysEternalStorage.address);
      logs[0].args.votingToChangeMinThresholdEternalStorage.should.be.equal(votingToChangeMinThresholdEternalStorage.address);
      logs[0].args.votingToChangeProxy.should.be.equal(votingToChangeProxy);
      logs[0].args.ballotsStorageEternalStorage.should.be.equal(ballotsEternalStorage.address);
      logs[0].args.validatorMetadataEternalStorage.should.be.equal(validatorMetadataEternalStorage.address);
    })
    it('prevents Moc to call it more than once', async () => {
      false.should.be.equal(await proxyStorage.mocInitialized());
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxy,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address
      ).should.be.fulfilled;
      true.should.be.equal(await proxyStorage.mocInitialized());
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxy,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address
      ).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#setContractAddress', async () => {
    beforeEach(async () => {
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeysEternalStorage.address,
        votingToChangeMinThresholdEternalStorage.address,
        votingToChangeProxy,
        ballotsEternalStorage.address,
        validatorMetadataEternalStorage.address,
        {from: masterOfCeremony}
      ).should.be.fulfilled;
    })
    it('can only be called from votingToChangeProxy address', async () => {
      await proxyStorage.setContractAddress(1, accounts[2], {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await proxyStorage.setContractAddress(1, accounts[2], {from: votingToChangeProxy}).should.be.fulfilled;
    })
    it('cannot be set to 0x0 address', async () => {
      await proxyStorage.setContractAddress(1, '0x0000000000000000000000000000000000000000', {from: votingToChangeProxy}).should.be.rejectedWith(ERROR_MSG);
    })
    it('sets keysManager', async () => {
      await proxyStorage.setContractAddress(1, accounts[2], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[2].should.be.equal(
        await proxyStorage.getKeysManager()
      )
    })
    it('sets votingToChangeKeys', async () => {
      let votingToChangeKeysNew = await VotingToChangeKeys.new();
      await proxyStorage.setContractAddress(2, votingToChangeKeysNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      
      let eternalProxyAddress = await proxyStorage.getVotingToChangeKeys();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      votingToChangeKeysNew.address.should.be.equal(
        await eternalProxy.implementation()
      )
    })
    it('sets votingToChangeMinThreshold', async () => {
      let votingToChangeMinThresholdNew = await VotingToChangeMinThreshold.new();
      await proxyStorage.setContractAddress(3, votingToChangeMinThresholdNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      
      let eternalProxyAddress = await proxyStorage.getVotingToChangeMinThreshold();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      votingToChangeMinThresholdNew.address.should.be.equal(
        await eternalProxy.implementation()
      )
    })
    it('sets votingToChangeProxy', async () => {
      await proxyStorage.setContractAddress(4, accounts[3], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[3].should.be.equal(
        await proxyStorage.getVotingToChangeProxy()
      )
    })
    it('sets ballotsStorage', async () => {
      let ballotsStorageNew = await BallotsStorage.new();
      await proxyStorage.setContractAddress(5, ballotsStorageNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      
      let eternalProxyAddress = await proxyStorage.getBallotsStorage();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      ballotsStorageNew.address.should.be.equal(
        await eternalProxy.implementation()
      )
    })
    it('sets poaConsensus', async () => {
      await proxyStorage.setContractAddress(6, accounts[5], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[5].should.be.equal(
        await proxyStorage.getPoaConsensus()
      )
    })
    it('sets validatorMetadata', async () => {
      let validatorMetadataNew = await ValidatorMetadata.new();
      await proxyStorage.setContractAddress(7, validatorMetadataNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      
      let eternalProxyAddress = await proxyStorage.getValidatorMetadata();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);

      validatorMetadataNew.address.should.be.equal(
        await eternalProxy.implementation()
      )
    })
    it('changes proxyStorage (itself) implementation', async () => {
      const oldVersion = await proxyStorage.version();
      const newVersion = oldVersion.add(1);
      let proxyStorageNew = await ProxyStorageMock.new();
      await proxyStorage.setContractAddress(8, proxyStorageNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      proxyStorageNew.address.should.be.equal(
        await proxyStorageEternalStorage.implementation()
      );
      proxyStorageNew.address.should.be.equal(
        await proxyStorage.implementation()
      );
      newVersion.should.be.bignumber.equal(
        await proxyStorageEternalStorage.version()
      );
      proxyStorageNew = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
      newVersion.should.be.bignumber.equal(
        await proxyStorageNew.version()
      );
    })
  })
})
