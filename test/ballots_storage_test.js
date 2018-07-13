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
contract('BallotsStorage [all features]', function (accounts) {
  let {
    keysManager,
    votingToChangeKeys,
    votingToChangeMinThreshold,
    votingToChangeProxy,
    votingToManageEmissionFunds,
    validatorMetadataEternalStorage,
    rewardByBlock
  } = {
    keysManager: '',
    votingToChangeKeys: accounts[0],
    votingToChangeMinThreshold: accounts[3],
    votingToChangeProxy: accounts[4],
    votingToManageEmissionFunds: accounts[5],
    validatorMetadataEternalStorage: accounts[7],
    rewardByBlock: accounts[8]
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
    await ballotsStorage.init([3, 2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    keysManager = await KeysManagerMock.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorage.address, keysManager.address);
    keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;
    
    await poaNetworkConsensus.setProxyStorage(proxyStorage.address);
    await proxyStorage.initializeAddresses(
      keysManager.address,
      votingToChangeKeys,
      votingToChangeMinThreshold,
      votingToChangeProxy,
      votingToManageEmissionFunds,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage,
      rewardByBlock
    );
  })
  
  describe('#init', async () => {
    it('prevent from double init', async () => {
      await ballotsStorage.init([3, 2]).should.be.rejectedWith(ERROR_MSG);
    })
    it('thresholds are correct', async () => {
      new web3.BigNumber(3).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold.call(1)
      );
      new web3.BigNumber(2).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold.call(2)
      );
    })
  })
  describe('#migrate', async () => {
    it('should copy thresholds from an old contract', async () => {
      let ballotsStorageNew = await BallotsStorage.new();
      const ballotsEternalStorageNew = await EternalStorageProxy.new(proxyStorage.address, ballotsStorageNew.address);
      ballotsStorageNew = await BallotsStorage.at(ballotsEternalStorageNew.address);
      (await ballotsStorageNew.getBallotThreshold.call(1)).should.be.bignumber.equal(0);
      (await ballotsStorageNew.getBallotThreshold.call(2)).should.be.bignumber.equal(0);
      await ballotsStorageNew.migrate('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageNew.migrate(ballotsStorage.address, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageNew.migrate(ballotsStorage.address).should.be.fulfilled;
      (await ballotsStorageNew.getBallotThreshold.call(1)).should.be.bignumber.equal(3);
      (await ballotsStorageNew.getBallotThreshold.call(2)).should.be.bignumber.equal(2);
      await ballotsStorageNew.migrate(ballotsStorage.address).should.be.rejectedWith(ERROR_MSG);
    });
  });
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
      new web3.BigNumber(5).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold.call(1));
    })
    it('sets new value for MetadataChange threshold', async () => {
      await ballotsStorage.setThreshold(6, 2, {from: accounts[3]}).should.be.fulfilled;
      new web3.BigNumber(6).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold.call(2));
    })
  })
  describe('#getProxyThreshold', async () => {
    it('return value is correct', async () => {
      new web3.BigNumber(1).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call())
      await proxyStorage.setKeysManagerMock(masterOfCeremony);
      await poaNetworkConsensus.addValidator(accounts[1], true);
      await poaNetworkConsensus.addValidator(accounts[2], true);
      await poaNetworkConsensus.addValidator(accounts[3], true);
      await poaNetworkConsensus.addValidator(accounts[4], true);
      await poaNetworkConsensus.addValidator(accounts[5], true);
      await proxyStorage.setKeysManagerMock(keysManager.address);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      const getValidators = await poaNetworkConsensus.getValidators.call();
      new web3.BigNumber(6).should.be.bignumber.equal(getValidators.length);
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(false);
      new web3.BigNumber(3).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call())
    });
    it('return value is correct if MoC is removed', async () => {
      new web3.BigNumber(1).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call())
      await proxyStorage.setKeysManagerMock(masterOfCeremony);
      await poaNetworkConsensus.addValidator(accounts[1], true);
      await poaNetworkConsensus.addValidator(accounts[2], true);
      await poaNetworkConsensus.addValidator(accounts[3], true);
      await poaNetworkConsensus.addValidator(accounts[4], true);
      await poaNetworkConsensus.addValidator(accounts[5], true);
      await poaNetworkConsensus.addValidator(accounts[6], true);
      await proxyStorage.setKeysManagerMock(keysManager.address);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      const getValidators = await poaNetworkConsensus.getValidators.call();
      new web3.BigNumber(7).should.be.bignumber.equal(getValidators.length);
      new web3.BigNumber(4).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call());
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000001', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000002', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000003', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000004', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000005', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000006', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000007', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000008', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000009', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000010', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000011', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000012', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.removeMiningKey(masterOfCeremony, {from: votingToChangeKeys});
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(true);
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(6);
      new web3.BigNumber(4).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call());
    });
  })
  describe('#getVotingToChangeThreshold', async () => {
    it('returns voting to change min threshold address', async () => {
      votingToChangeMinThreshold.should.be.equal(await ballotsStorage.getVotingToChangeThreshold.call())
      await proxyStorage.setVotingToChangeMinThresholdMock(accounts[4]);
      accounts[4].should.be.equal(await ballotsStorage.getVotingToChangeThreshold.call())
    })
  })
  describe('#getBallotLimitPerValidator', async () => {
    it('returns correct limit', async () => {
      let limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(200);

      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(100);
    });
    it('returns correct limit if MoC is removed', async () => {
      let limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(200);

      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(3);

      await keysManager.initiateKeys('0x0000000000000000000000000000000000000001', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000002', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000003', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000004', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000005', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000006', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000007', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000008', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000009', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000010', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000011', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000012', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.removeMiningKey(masterOfCeremony, {from: votingToChangeKeys});
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(true);
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(2);

      limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(100);
    });
  })
  describe('#upgradeTo', async () => {
    const proxyStorageStubAddress = accounts[8];
    let ballotsEternalStorage;
    beforeEach(async () => {
      ballotsStorage = await BallotsStorage.new();
      ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);
      ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    });
    it('may be called only by ProxyStorage', async () => {
      const ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('should change implementation address', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      const oldImplementation = await ballotsStorage.implementation.call();
      const newImplementation = ballotsStorageNew.address;
      (await ballotsEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.implementation.call()).should.be.equal(newImplementation);
      (await ballotsEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      const oldVersion = await ballotsStorage.version.call();
      const newVersion = oldVersion.add(1);
      (await ballotsEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.version.call()).should.be.bignumber.equal(newVersion);
      (await ballotsEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.initialized.call()).should.be.equal(false);
      await ballotsStorageNew.initialize();
      (await ballotsStorageNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('new implementation should use the same storage', async () => {
      await ballotsStorage.setThreshold(6, 1, {from: votingToChangeMinThreshold});
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      const threshold = await ballotsStorageNew.getBallotThreshold.call(1);
      threshold.should.be.bignumber.equal(6);
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
  });
})
