let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let proxyStorage, masterOfCeremony;
contract('ProxyStorage [all features]', function (accounts) {
  let {
    keysManager,
    votingToChangeKeys,
    votingToChangeMinThreshold,
    votingToChangeProxy,
    ballotsStorage,
    validatorMetadata,
    validatorMetadataEternalStorage
  } = {
    keysManager: accounts[1],
    votingToChangeKeys: accounts[2],
    votingToChangeMinThreshold: accounts[3],
    votingToChangeProxy: accounts[4],
    ballotsStorage: accounts[5],
    validatorMetadata: accounts[6],
    validatorMetadataEternalStorage: accounts[7]
  }
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    proxyStorage = await ProxyStorageMock.new(poaNetworkConsensus.address);
  })
  describe('#contstuctor', async () => {
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
        validatorMetadata,
        validatorMetadataEternalStorage,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata,
        validatorMetadataEternalStorage
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
      validatorMetadata.should.be.equal(
        await proxyStorage.getValidatorMetadata()
      );
      validatorMetadataEternalStorage.should.be.equal(
        await proxyStorage.getValidatorMetadataEternalStorage()
      );
      logs[0].event.should.be.equal('ProxyInitialized');
      logs[0].args.keysManager.should.be.equal(keysManager);
      logs[0].args.votingToChangeKeys.should.be.equal(votingToChangeKeys);
      logs[0].args.votingToChangeMinThreshold.should.be.equal(votingToChangeMinThreshold);
      logs[0].args.votingToChangeProxy.should.be.equal(votingToChangeProxy);
      logs[0].args.ballotsStorage.should.be.equal(ballotsStorage);
      logs[0].args.validatorMetadata.should.be.equal(validatorMetadata);
      logs[0].args.validatorMetadataEternalStorage.should.be.equal(validatorMetadataEternalStorage);
    })
    it('prevents Moc to call it more than once', async () => {
      false.should.be.equal(await proxyStorage.mocInitialized());
      const {logs} = await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata,
        validatorMetadataEternalStorage
      ).should.be.fulfilled;
      true.should.be.equal(await proxyStorage.mocInitialized());
      await proxyStorage.initializeAddresses(
        keysManager,
        votingToChangeKeys,
        votingToChangeMinThreshold,
        votingToChangeProxy,
        ballotsStorage,
        validatorMetadata,
        validatorMetadataEternalStorage
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
        validatorMetadata,
        validatorMetadataEternalStorage,
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
      await proxyStorage.setContractAddress(7, accounts[6], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[6].should.be.equal(
        await proxyStorage.getValidatorMetadata()
      )
    })
    it('sets validatorMetadataEternalStorage', async () => {
      await proxyStorage.setContractAddress(8, accounts[7], {from: votingToChangeProxy}).should.be.fulfilled;
      accounts[7].should.be.equal(
        await proxyStorage.getValidatorMetadataEternalStorage()
      )
    })
  })  
})
