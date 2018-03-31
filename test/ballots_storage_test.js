let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let BallotsStorageMock = artifacts.require('./mockContracts/BallotsStorageMock');
let VotingToChangeMinThresholdMock = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let proxyStorage, masterOfCeremony;
contract('BallotsStorage [all features]', function (accounts) {
  let {
    keysManager,
    votingToChangeKeys,
    votingToChangeMinThreshold,
    votingToChangeProxy,
    validatorMetadataEternalStorage
  } = {
    keysManager: '',
    votingToChangeKeys: accounts[0],
    votingToChangeMinThreshold: accounts[3],
    votingToChangeProxy: accounts[4],
    validatorMetadataEternalStorage: accounts[7]
  }
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    proxyStorage = await ProxyStorageMock.new(poaNetworkConsensus.address);
    ballotsStorageMock = await BallotsStorageMock.new(proxyStorage.address);
    keysManager = await KeysManagerMock.new(proxyStorage.address, poaNetworkConsensus.address, masterOfCeremony, "0x0000000000000000000000000000000000000000");
    await poaNetworkConsensus.setProxyStorage(proxyStorage.address);
    await proxyStorage.initializeAddresses(
      keysManager.address,
      votingToChangeKeys,
      votingToChangeMinThreshold,
      votingToChangeProxy,
      ballotsStorageMock.address,
      validatorMetadataEternalStorage
    );
  })
  describe('#constructor', async () => {
    it('sets MoC and Poa', async () => {
      new web3.BigNumber(3).should.be.bignumber.equal(
        await ballotsStorageMock.getBallotThreshold(1)
      );
      new web3.BigNumber(2).should.be.bignumber.equal(
        await ballotsStorageMock.getBallotThreshold(2)
      );
    })
  })
  describe('#setThreshold', async () => {
    it('can only be called from votingToChangeThreshold address', async () => {
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
    })
    it('cannot be set for Invalid threshold', async () => {
      await ballotsStorageMock.setThreshold(5, 0, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, -10, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, -1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, 3, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('new value cannot be equal to 0', async () => {
      await ballotsStorageMock.setThreshold(0, 1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(0, 2, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
      await ballotsStorageMock.setThreshold(4, 2, {from: accounts[3]}).should.be.fulfilled;
    })
    it('sets new value for Keys threshold', async () => {
      await ballotsStorageMock.setThreshold(5, 1, {from: accounts[3]}).should.be.fulfilled; 
      new web3.BigNumber(5).should.be.bignumber.equal(await ballotsStorageMock.getBallotThreshold(1));
    })
    it('sets new value for MetadataChange threshold', async () => {
      await ballotsStorageMock.setThreshold(6, 2, {from: accounts[3]}).should.be.fulfilled;
      new web3.BigNumber(6).should.be.bignumber.equal(await ballotsStorageMock.getBallotThreshold(2));
    })
  })
  describe('#getTotalNumberOfValidators', async () => {
    it('returns total number of validators', async () => {
      await proxyStorage.setKeysManagerMock(masterOfCeremony);
      await poaNetworkConsensus.addValidator(accounts[1], true);
      await poaNetworkConsensus.setSystemAddress(masterOfCeremony);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      const getValidators = await poaNetworkConsensus.getValidators();
      new web3.BigNumber(2).should.be.bignumber.equal(getValidators.length);
      new web3.BigNumber(2).should.be.bignumber.equal(await ballotsStorageMock.getTotalNumberOfValidators())
    })
  })  
  describe('#getProxyThreshold', async () => {
    it('returns total number of validators', async () => {
      new web3.BigNumber(1).should.be.bignumber.equal(await ballotsStorageMock.getProxyThreshold())
      await proxyStorage.setKeysManagerMock(masterOfCeremony);
      await poaNetworkConsensus.addValidator(accounts[1], true);
      await poaNetworkConsensus.addValidator(accounts[2], true);
      await poaNetworkConsensus.addValidator(accounts[3], true);
      await poaNetworkConsensus.addValidator(accounts[4], true);
      await poaNetworkConsensus.addValidator(accounts[5], true);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      const getValidators = await poaNetworkConsensus.getValidators();
      new web3.BigNumber(6).should.be.bignumber.equal(getValidators.length);
      new web3.BigNumber(4).should.be.bignumber.equal(await ballotsStorageMock.getProxyThreshold())
    })
  })
  describe('#getVotingToChangeThreshold', async () => {
    it('returns voting to change min threshold address', async () => {
      votingToChangeMinThreshold.should.be.equal(await ballotsStorageMock.getVotingToChangeThreshold())
      await proxyStorage.setVotingToChangeMinThresholdMock(accounts[4]);
      accounts[4].should.be.equal(await ballotsStorageMock.getVotingToChangeThreshold())
    })
  })
  describe('#getBallotLimit', async () => {
    it('returns limit per validator to create ballots', async () => {
      let limit = await ballotsStorageMock.getBallotLimitPerValidator();
      limit.should.be.bignumber.equal(200);

      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      limit = await ballotsStorageMock.getBallotLimitPerValidator();
      limit.should.be.bignumber.equal(100);
    })
  })
})

