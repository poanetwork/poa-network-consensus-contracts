const RewardByBlock = artifacts.require('./mockContracts/RewardByBlockMock');
const RewardByBlockNew = artifacts.require('./upgradeContracts/RewardByBlockNew');
const EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const KeysManager = artifacts.require('./mockContracts/KeysManagerMock');
const PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
const ProxyStorage = artifacts.require('./mockContracts/ProxyStorageMock');
const {getRandomInt} = require('./utils/helpers');

const ERROR_MSG = 'VM Exception while processing transaction: revert';

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('RewardByBlock [all features]', function (accounts) {
  let poaNetworkConsensus, proxyStorage, keysManager;
  let rewardByBlock, rewardByBlockEternalStorage;
  let blockRewardAmount, emissionFundsAmount, emissionFundsAddress;
  let coinbase;
  let masterOfCeremony;
  let miningKey;
  let miningKey2;
  let miningKey3;
  let payoutKey;
  let payoutKey2;
  let payoutKey3;
  let systemAddress;
  let votingToChangeKeys;
  
  beforeEach(async () => {
    coinbase = accounts[0];
    masterOfCeremony = accounts[0];
    miningKey = accounts[1];
    miningKey2 = accounts[2];
    miningKey3 = accounts[3];
    payoutKey = accounts[4];
    payoutKey2 = accounts[5];
    payoutKey3 = accounts[6];
    systemAddress = accounts[7];
    votingToChangeKeys = accounts[9];

    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []);

    proxyStorage = await ProxyStorage.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorage.address);
    proxyStorage = await ProxyStorage.at(proxyStorageEternalStorage.address);
    await proxyStorage.init(poaNetworkConsensus.address).should.be.fulfilled;

    await poaNetworkConsensus.setProxyStorage(proxyStorage.address);

    keysManager = await KeysManager.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorage.address, keysManager.address);
    keysManager = await KeysManager.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;

    await proxyStorage.initializeAddresses(
      keysManagerEternalStorage.address,
      votingToChangeKeys,
      accounts[9],
      accounts[9],
      accounts[9],
      accounts[9],
      accounts[9],
      accounts[9]
    );

    await keysManager.addMiningKey(miningKey, {from: votingToChangeKeys}).should.be.fulfilled;
    await keysManager.addMiningKey(miningKey2, {from: votingToChangeKeys}).should.be.fulfilled;
    await keysManager.addMiningKey(miningKey3, {from: votingToChangeKeys}).should.be.fulfilled;
    await keysManager.addPayoutKey(payoutKey, miningKey, {from: votingToChangeKeys}).should.be.fulfilled;
    await keysManager.addPayoutKey(payoutKey2, miningKey2, {from: votingToChangeKeys}).should.be.fulfilled;
    await keysManager.addPayoutKey(payoutKey3, miningKey3, {from: votingToChangeKeys}).should.be.fulfilled;
    await poaNetworkConsensus.setSystemAddress(coinbase);
    await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
    await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');

    rewardByBlock = await RewardByBlock.new();
    rewardByBlockEternalStorage = await EternalStorageProxy.new(proxyStorage.address, rewardByBlock.address);
    rewardByBlock = await RewardByBlock.at(rewardByBlockEternalStorage.address);

    blockRewardAmount = web3.toWei(1, 'ether');
    emissionFundsAmount = web3.toWei(1, 'ether');
    emissionFundsAddress = '0x0000000000000000000000000000000000000000';
  });

  describe('#reward', async () => {
    it('may be called only by system address', async () => {
      await rewardByBlock.reward([miningKey], [0]).should.be.rejectedWith(ERROR_MSG);
      await rewardByBlock.setSystemAddress(systemAddress);
      await rewardByBlock.reward([miningKey], [0], {from: systemAddress}).should.be.fulfilled;
    });

    it('should revert if input array contains more than one item', async () => {
      await rewardByBlock.setSystemAddress(systemAddress);
      await rewardByBlock.reward(
        [miningKey, miningKey2],
        [0, 0],
        {from: systemAddress}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should revert if lengths of input arrays are not equal', async () => {
      await rewardByBlock.setSystemAddress(systemAddress);
      await rewardByBlock.reward(
        [miningKey],
        [0, 0],
        {from: systemAddress}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should revert if `kind` parameter is not 0', async () => {
      await rewardByBlock.setSystemAddress(systemAddress);
      await rewardByBlock.reward(
        [miningKey],
        [1],
        {from: systemAddress}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should revert if mining key does not exist', async () => {
      await keysManager.removeMiningKey(miningKey3, {from: votingToChangeKeys}).should.be.fulfilled;
      await rewardByBlock.setSystemAddress(systemAddress);
      await rewardByBlock.reward(
        [miningKey3],
        [0],
        {from: systemAddress}
      ).should.be.rejectedWith(ERROR_MSG);
      await rewardByBlock.reward(
        [miningKey2],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;
    });

    it('should assign rewards to payout key and EmissionFunds', async () => {
      await rewardByBlock.setSystemAddress(systemAddress);
      const {logs} = await rewardByBlock.reward(
        [miningKey],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;
      logs[0].event.should.be.equal('Rewarded');
      logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress]);
      logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
    });

    it('should assign reward to mining key if payout key is 0', async () => {
      await keysManager.removePayoutKey(
        miningKey,
        {from: votingToChangeKeys}
      ).should.be.fulfilled;

      await rewardByBlock.setSystemAddress(systemAddress);
      const {logs} = await rewardByBlock.reward(
        [miningKey],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;

      logs[0].event.should.be.equal('Rewarded');
      logs[0].args.receivers.should.be.deep.equal([miningKey, emissionFundsAddress]);
      logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
    });

    it('should assign rewards to extra receivers and clear extra receivers list', async () => {
      await rewardByBlock.setBridgeContractAddress(accounts[1]);
      await rewardByBlock.addExtraReceiver(accounts[2], 2, {from: accounts[1]}).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(accounts[3], 3, {from: accounts[1]}).should.be.fulfilled;

      await rewardByBlock.setSystemAddress(systemAddress);
      let result = await rewardByBlock.reward(
        [miningKey],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress, accounts[2], accounts[3]]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal('2');
      result.logs[0].args.rewards[3].toString().should.be.equal('3');

      (await rewardByBlock.extraReceiversAmounts.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);

      await rewardByBlock.addExtraReceiver(accounts[2], 2, {from: accounts[1]}).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(accounts[3], 3, {from: accounts[1]}).should.be.fulfilled;
      result = await rewardByBlock.reward(
        [miningKey],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress, accounts[2], accounts[3]]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal('2');
      result.logs[0].args.rewards[3].toString().should.be.equal('3');

      (await rewardByBlock.extraReceiversAmounts.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);
    });
  });

  describe('#addExtraReceiver', async () => {
    it('may be called only by bridge contract', async () => {
      await rewardByBlock.addExtraReceiver(accounts[1], 1).should.be.rejectedWith(ERROR_MSG);
      await rewardByBlock.setBridgeContractAddress(accounts[2]);
      await rewardByBlock.addExtraReceiver(accounts[1], 1, {from: accounts[2]}).should.be.fulfilled;
    });

    it('should revert if receiver address is 0x0', async () => {
      await rewardByBlock.setBridgeContractAddress(accounts[2]);
      await rewardByBlock.addExtraReceiver(
        '0x0000000000000000000000000000000000000000',
        1,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should revert if amount is 0', async () => {
      await rewardByBlock.setBridgeContractAddress(accounts[2]);
      await rewardByBlock.addExtraReceiver(
        accounts[1],
        0,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('can only be called once for the same recipient', async () => {
      await rewardByBlock.setBridgeContractAddress(accounts[2]);
      await rewardByBlock.addExtraReceiver(
        accounts[1],
        1,
        {from: accounts[2]}
      ).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(
        accounts[1],
        1,
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should add receivers', async () => {
      await rewardByBlock.setBridgeContractAddress(accounts[1]);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);

      let result = await rewardByBlock.addExtraReceiver(accounts[2], 2, {from: accounts[1]}).should.be.fulfilled;
      (await rewardByBlock.extraReceivers.call(0)).should.be.equal(accounts[2]);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[2])).should.be.bignumber.equal(2);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(1);
      result.logs[0].event.should.be.equal('AddedReceiver');
      result.logs[0].args.receiver.should.be.equal(accounts[2]);
      result.logs[0].args.amount.should.be.bignumber.equal(2);

      result = await rewardByBlock.addExtraReceiver(accounts[3], 3, {from: accounts[1]}).should.be.fulfilled;
      (await rewardByBlock.extraReceivers.call(0)).should.be.equal(accounts[2]);
      (await rewardByBlock.extraReceivers.call(1)).should.be.equal(accounts[3]);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[2])).should.be.bignumber.equal(2);
      (await rewardByBlock.extraReceiversAmounts.call(accounts[3])).should.be.bignumber.equal(3);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(2);
      result.logs[0].event.should.be.equal('AddedReceiver');
      result.logs[0].args.receiver.should.be.equal(accounts[3]);
      result.logs[0].args.amount.should.be.bignumber.equal(3);
    });
  });

  describe('#upgradeTo', async () => {
    const proxyStorageStubAddress = accounts[8];
    it('may be called only by ProxyStorage', async () => {
      const rewardByBlockNew = await RewardByBlockNew.new();
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('should change implementation address', async () => {
      let rewardByBlockNew = await RewardByBlockNew.new();
      const oldImplementation = await rewardByBlock.implementation.call();
      const newImplementation = rewardByBlockNew.address;
      (await rewardByBlockEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByBlockNew = await RewardByBlockNew.at(rewardByBlockEternalStorage.address);
      (await rewardByBlockNew.implementation.call()).should.be.equal(newImplementation);
      (await rewardByBlockEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let rewardByBlockNew = await RewardByBlockNew.new();
      const oldVersion = await rewardByBlock.version.call();
      const newVersion = oldVersion.add(1);
      (await rewardByBlockEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: proxyStorageStubAddress});
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByBlockNew = await RewardByBlockNew.at(rewardByBlockEternalStorage.address);
      (await rewardByBlockNew.version.call()).should.be.bignumber.equal(newVersion);
      (await rewardByBlockEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let rewardByBlockNew = await RewardByBlockNew.new();
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: proxyStorageStubAddress});
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByBlockNew = await RewardByBlockNew.at(rewardByBlockEternalStorage.address);
      (await rewardByBlockNew.initialized.call()).should.be.equal(false);
      await rewardByBlockNew.initialize();
      (await rewardByBlockNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let rewardByBlockNew = await RewardByBlockNew.new();
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: proxyStorageStubAddress});
      rewardByBlockNew = await RewardByBlockNew.at(rewardByBlockEternalStorage.address);
      (await rewardByBlockNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
      await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
    });
  });
});
