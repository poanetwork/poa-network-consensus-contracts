let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
let BallotsStorageNew = artifacts.require('./upgradeContracts/BallotsStorageNew');
let VotingToChangeMinThresholdMock = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let EternalStorageProxy = artifacts.require('./EternalStorageProxyMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let masterOfCeremony, poaNetworkConsensus, proxyStorage, ballotsStorage;
contract('BallotsStorage upgraded [all features]', function (accounts) {
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
    
    proxyStorage = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorage.address);
    proxyStorage = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorage.init(poaNetworkConsensus.address).should.be.fulfilled;
    
    ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init(false, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    await ballotsStorage.init(false).should.be.fulfilled;

    keysManager = await KeysManagerMock.new(proxyStorage.address, poaNetworkConsensus.address, masterOfCeremony, "0x0000000000000000000000000000000000000000");
    await poaNetworkConsensus.setProxyStorage(proxyStorage.address);
    await proxyStorage.initializeAddresses(
      keysManager.address,
      votingToChangeKeys,
      votingToChangeMinThreshold,
      votingToChangeProxy,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage
    );

    let ballotsStorageNew = await BallotsStorageNew.new();
    await ballotsEternalStorage.setProxyStorage(accounts[6]);
    await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: accounts[6]});
    await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    ballotsStorage = await BallotsStorageNew.at(ballotsEternalStorage.address);
  })
  describe('#init', async () => {
    it('prevent from double init', async () => {
      await ballotsStorage.init(false).should.be.rejectedWith(ERROR_MSG);
    })
    it('thresholds are correct', async () => {
      new web3.BigNumber(3).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold(1)
      );
      new web3.BigNumber(2).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold(2)
      );
    })
  })
  describe('#setThreshold', async () => {
    it('can only be called from votingToChangeThreshold address', async () => {
      await ballotsStorage.setThreshold(4, 1, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
    })
    it('cannot be set for Invalid threshold', async () => {
      await ballotsStorage.setThreshold(5, 0, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(5, -10, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(5, -1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(5, 3, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('new value cannot be equal to 0', async () => {
      await ballotsStorage.setThreshold(0, 1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(0, 2, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorage.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
      await ballotsStorage.setThreshold(4, 2, {from: accounts[3]}).should.be.fulfilled;
    })
    it('sets new value for Keys threshold', async () => {
      await ballotsStorage.setThreshold(5, 1, {from: accounts[3]}).should.be.fulfilled; 
      new web3.BigNumber(5).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold(1));
    })
    it('sets new value for MetadataChange threshold', async () => {
      await ballotsStorage.setThreshold(6, 2, {from: accounts[3]}).should.be.fulfilled;
      new web3.BigNumber(6).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold(2));
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
      new web3.BigNumber(2).should.be.bignumber.equal(await ballotsStorage.getTotalNumberOfValidators())
    })
  })  
  describe('#getProxyThreshold', async () => {
    it('returns total number of validators', async () => {
      new web3.BigNumber(1).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold())
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
      new web3.BigNumber(3).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold())
    })
  })
  describe('#getVotingToChangeThreshold', async () => {
    it('returns voting to change min threshold address', async () => {
      votingToChangeMinThreshold.should.be.equal(await ballotsStorage.getVotingToChangeThreshold())
      await proxyStorage.setVotingToChangeMinThresholdMock(accounts[4]);
      accounts[4].should.be.equal(await ballotsStorage.getVotingToChangeThreshold())
    })
  })
  describe('#getBallotLimit', async () => {
    it('returns limit per validator to create ballots', async () => {
      let limit = await ballotsStorage.getBallotLimitPerValidator();
      limit.should.be.bignumber.equal(200);

      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      limit = await ballotsStorage.getBallotLimitPerValidator();
      limit.should.be.bignumber.equal(100);
    })
  })
})
