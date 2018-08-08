let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
let BallotsStorageNew = artifacts.require('./upgradeContracts/BallotsStorageNew');
let VotingToChangeMinThresholdMock = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
let EternalStorageProxy = artifacts.require('./EternalStorageProxyMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let keysManager;
let masterOfCeremony, poaNetworkConsensus, proxyStorage, ballotsStorage;
let ballotsEternalStorage;
contract('BallotsStorage [all features]', function (accounts) {
  let votingToChangeKeys;
  let votingToChangeMinThreshold;
  let votingToChangeProxy;
  let votingToManageEmissionFunds;
  let rewardByBlock;

  beforeEach(async () => {
    masterOfCeremony = accounts[0];
    votingToChangeKeys = accounts[0];
    votingToChangeMinThreshold = accounts[3];
    votingToChangeProxy = accounts[4];
    votingToManageEmissionFunds = accounts[5];
    rewardByBlock = accounts[8];

    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);
    
    proxyStorage = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorage.address);
    proxyStorage = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorage.init(poaNetworkConsensus.address).should.be.fulfilled;
    
    ballotsStorage = await BallotsStorage.new();
    ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    keysManager = await KeysManagerMock.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorage.address, keysManager.address);
    keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);
    
    await poaNetworkConsensus.setProxyStorage(proxyStorage.address);
    await proxyStorage.initializeAddresses(
      keysManager.address,
      votingToChangeKeys,
      votingToChangeMinThreshold,
      votingToChangeProxy,
      votingToManageEmissionFunds,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address,
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
      await setThreshold(4, 1, true, {from: accounts[3]});
    })
    it('cannot be set for Invalid threshold', async () => {
      await setThreshold(3, 1, false, {from: accounts[3]});
      await setThreshold(5, 0, false, {from: accounts[3]});
      await setThreshold(5, -10, false, {from: accounts[3]});
      await setThreshold(5, -1, false, {from: accounts[3]});
      await setThreshold(5, 3, false, {from: accounts[3]});
    })
    it('new value cannot be equal to 0', async () => {
      await setThreshold(0, 1, false, {from: accounts[3]});
      await setThreshold(0, 2, false, {from: accounts[3]});
      await setThreshold(4, 1, true, {from: accounts[3]});
      await setThreshold(4, 2, true, {from: accounts[3]});
    })
    it('sets new value for Keys threshold', async () => {
      await setThreshold(5, 1, true, {from: accounts[3]});
      new web3.BigNumber(5).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold.call(1));
    })
    it('sets new value for MetadataChange threshold', async () => {
      await setThreshold(6, 2, true, {from: accounts[3]});
      new web3.BigNumber(6).should.be.bignumber.equal(await ballotsStorage.getBallotThreshold.call(2));
    })
  })
  describe('#getProxyThreshold', async () => {
    it('return value is correct', async () => {
      new web3.BigNumber(1).should.be.bignumber.equal(await ballotsStorage.getProxyThreshold.call())
      await proxyStorage.setKeysManagerMock(masterOfCeremony);
      await addValidator(accounts[1]);
      await addValidator(accounts[2]);
      await addValidator(accounts[3]);
      await addValidator(accounts[4]);
      await addValidator(accounts[5]);
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
      await addValidator(accounts[1]);
      await addValidator(accounts[2]);
      await addValidator(accounts[3]);
      await addValidator(accounts[4]);
      await addValidator(accounts[5]);
      await addValidator(accounts[6]);
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
      const {logs} = await keysManager.removeMiningKey(masterOfCeremony, {from: votingToChangeKeys});
      logs[0].event.should.equal("MiningKeyChanged");
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

      await addMiningKey(accounts[1]);
      await addMiningKey(accounts[2]);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(100);
    });
    it('returns correct limit if MoC is removed', async () => {
      let limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(200);

      await addMiningKey(accounts[1]);
      await addMiningKey(accounts[2]);
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
      const {logs} = await keysManager.removeMiningKey(masterOfCeremony, {from: votingToChangeKeys});
      logs[0].event.should.equal("MiningKeyChanged");
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(true);
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(2);

      limit = await ballotsStorage.getBallotLimitPerValidator.call();
      limit.should.be.bignumber.equal(100);
    });
  })
  describe('#upgradeTo', async () => {
    let proxyStorageStubAddress;
    beforeEach(async () => {
      proxyStorageStubAddress = accounts[8];
      ballotsStorage = await BallotsStorage.new();
      ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);
      ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    });
    it('may be called only by ProxyStorage', async () => {
      const ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await ballotsEternalStorage.upgradeTo(ballotsStorageNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('should change implementation address', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      const oldImplementation = await ballotsStorage.implementation.call();
      const newImplementation = ballotsStorageNew.address;
      (await ballotsEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
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
      await upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.version.call()).should.be.bignumber.equal(newVersion);
      (await ballotsEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.initialized.call()).should.be.equal(false);
      await ballotsStorageNew.initialize();
      (await ballotsStorageNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      (await ballotsStorageNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('new implementation should use the same storage', async () => {
      await setThreshold(6, 1, true, {from: votingToChangeMinThreshold});
      let ballotsStorageNew = await BallotsStorageNew.new();
      await ballotsEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(ballotsStorageNew.address, {from: proxyStorageStubAddress});
      ballotsStorageNew = await BallotsStorageNew.at(ballotsEternalStorage.address);
      const threshold = await ballotsStorageNew.getBallotThreshold.call(1);
      threshold.should.be.bignumber.equal(6);
      await ballotsEternalStorage.setProxyStorage(proxyStorage.address);
    });
  });
})

async function addValidator(_validator) {
  const {logs} = await poaNetworkConsensus.addValidator(_validator, true);
  logs[0].event.should.be.equal("InitiateChange");
}

async function addMiningKey(_key) {
  const {logs} = await keysManager.addMiningKey(_key);
  logs[0].event.should.be.equal("MiningKeyChanged");
}

async function setThreshold(_newValue, _thresholdType, _shouldBeSuccessful, options) {
  const result = await ballotsStorage.setThreshold(_newValue, _thresholdType, options);
  if (_shouldBeSuccessful) {
    result.logs[0].event.should.be.equal("ThresholdChanged");
  } else {
    result.logs.length.should.be.equal(0);
  }
}

async function upgradeTo(implementation, options) {
  const {logs} = await ballotsEternalStorage.upgradeTo(implementation, options);
  logs[0].event.should.be.equal("Upgraded");
}
