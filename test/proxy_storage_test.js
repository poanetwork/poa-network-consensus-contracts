let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
let EternalStorageProxy = artifacts.require('./EternalStorageProxy');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let proxyStorage, masterOfCeremony;
let validatorMetadata, validatorMetadataEternalStorage;
contract('ProxyStorage [all features]', function (accounts) {
  let {
    keysManager,
    votingToChangeKeys,
    votingToChangeMinThreshold,
    votingToChangeProxy,
    ballotsStorage
  } = {
    keysManager: accounts[1],
    votingToChangeKeys: accounts[2],
    votingToChangeMinThreshold: accounts[3],
    votingToChangeProxy: accounts[4],
    ballotsStorage: accounts[5]
  }
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    proxyStorage = await ProxyStorageMock.new(poaNetworkConsensus.address);
    validatorMetadata = await ValidatorMetadata.new();
    validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);
    let metadata = await ValidatorMetadata.at(validatorMetadataEternalStorage.address);
    await metadata.initProxyAddress(proxyStorage.address);
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
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata.address,
        validatorMetadataEternalStorage.address,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata.address,
        validatorMetadataEternalStorage.address,
      ).should.be.fulfilled;
      keysManager.should.be.equal(
        await proxyStorage.getKeysManager()
      );
      votingToChangeKeys.should.be.equal(
        await proxyStorage.getVotingToChangeKeys()
      );
      votingToChangeMinThreshold.should.be.equal(
        await proxyStorage.getVotingToChangeMinThreshold()
      );
      votingToChangeProxy.should.be.equal(
        await proxyStorage.getVotingToChangeProxy()
      );
      ballotsStorage.should.be.equal(
        await proxyStorage.getBallotsStorage()
      );
      validatorMetadata.address.should.be.equal(
        await proxyStorage.getValidatorMetadata()
      );
      validatorMetadataEternalStorage.address.should.be.equal(
        await proxyStorage.getValidatorMetadataEternalStorage()
      );
      logs[0].event.should.be.equal('ProxyInitialized');
      logs[0].args.keysManager.should.be.equal(keysManager);
      logs[0].args.votingToChangeKeys.should.be.equal(votingToChangeKeys);
      logs[0].args.votingToChangeMinThreshold.should.be.equal(votingToChangeMinThreshold);
      logs[0].args.votingToChangeProxy.should.be.equal(votingToChangeProxy);
      logs[0].args.ballotsStorage.should.be.equal(ballotsStorage);
      logs[0].args.validatorMetadata.should.be.equal(validatorMetadata.address);
      logs[0].args.validatorMetadataEternalStorage.should.be.equal(validatorMetadataEternalStorage.address);
    })
    it('prevents Moc to call it more than once', async () => {
      false.should.be.equal(await proxyStorage.mocInitialized());
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata.address,
        validatorMetadataEternalStorage.address
      ).should.be.fulfilled;
      true.should.be.equal(await proxyStorage.mocInitialized());
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata.address,
        validatorMetadataEternalStorage.address
      ).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#setContractAddress', async () => {
    beforeEach(async () => {
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata.address,
        validatorMetadataEternalStorage.address,
        {from: masterOfCeremony}
      ).should.be.fulfilled;
    })
    it('can only be called from votingToChangeProxy address', async () => {
      await proxyStorage.setContractAddress(1, accounts[2], {from: votingToChangeKeys}).should.be.rejectedWith(ERROR_MSG);
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
      await proxyStorage.setContractAddress(2, accounts[1], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[1].should.be.equal(
        await proxyStorage.getVotingToChangeKeys()
      )
    })
    it('sets votingToChangeMinThreshold', async () => {
      await proxyStorage.setContractAddress(3, accounts[2], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[2].should.be.equal(
        await proxyStorage.getVotingToChangeMinThreshold()
      )
    })
    it('sets votingToChangeProxy', async () => {
      await proxyStorage.setContractAddress(4, accounts[3], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[3].should.be.equal(
        await proxyStorage.getVotingToChangeProxy()
      )
    })
    it('sets ballotsStorage', async () => {
      await proxyStorage.setContractAddress(5, accounts[4], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[4].should.be.equal(
        await proxyStorage.getBallotsStorage()
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
      validatorMetadataNew.address.should.be.equal(
        await proxyStorage.getValidatorMetadata()
      )
    })
    it('sets validatorMetadataEternalStorage', async () => {
      let validatorMetadataEternalStorageNew = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);
      await proxyStorage.setContractAddress(8, validatorMetadataEternalStorageNew.address, {from: votingToChangeProxy}).should.be.fulfilled;
      validatorMetadataEternalStorageNew.address.should.be.equal(
        await proxyStorage.getValidatorMetadataEternalStorage()
      )
    })
  })  
})
