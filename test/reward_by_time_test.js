const RewardByTime = artifacts.require('./mockContracts/RewardByTimeMock');
const RewardByTimeNew = artifacts.require('./upgradeContracts/RewardByTimeNew');
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

let keysManager;
let votingToChangeKeys;
let rewardByTime, rewardByTimeEternalStorage;
contract('RewardByTime [all features]', function (accounts) {
  let poaNetworkConsensus, proxyStorage;
  let blockRewardAmount, emissionFundsAmount, emissionFundsAddress;
  let threshold;
  let coinbase;
  let masterOfCeremony;
  let miningKey;
  let miningKey2;
  let miningKey3;
  let payoutKey;
  let payoutKey2;
  let payoutKey3;
  let systemAddress;
  
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

    await addMiningKey(miningKey);
    await addMiningKey(miningKey2);
    await addMiningKey(miningKey3);
    await addPayoutKey(payoutKey, miningKey);
    await addPayoutKey(payoutKey2, miningKey2);
    await addPayoutKey(payoutKey3, miningKey3);
    await poaNetworkConsensus.setSystemAddress(coinbase);
    await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
    await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');

    rewardByTime = await RewardByTime.new();
    rewardByTimeEternalStorage = await EternalStorageProxy.new(proxyStorage.address, rewardByTime.address);
    rewardByTime = await RewardByTime.at(rewardByTimeEternalStorage.address);

    blockRewardAmount = web3.toWei(1, 'ether');
    emissionFundsAmount = web3.toWei(1, 'ether');
    emissionFundsAddress = '0x0000000000000000000000000000000000000000';
    threshold = 5;
  });

  describe('#reward', async () => {
    it('may be called only by system address', async () => {
      await rewardByTime.reward().should.be.rejectedWith(ERROR_MSG);
      await rewardByTime.setSystemAddress(systemAddress);
      await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
    });

    it('should assign rewards to payout keys and EmissionFunds', async () => {
      await rewardByTime.setSystemAddress(systemAddress);
      let result;
      
      await rewardByTime.setTime(100);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([masterOfCeremony, emissionFundsAddress]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(1);

      await rewardByTime.setTime(107);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100 + threshold);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(2);

      await rewardByTime.setTime(123);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([
        payoutKey2,
        payoutKey3,
        masterOfCeremony,
        emissionFundsAddress
      ]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[3].toString().should.be.equal((emissionFundsAmount * 3).toString());
      let lastTime = 100 + threshold * 4;
      let keyIndex = 1;
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(lastTime);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(keyIndex);

      const keysArray = [
        masterOfCeremony,
        payoutKey,
        payoutKey2,
        payoutKey3
      ];

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal(keysArray);

      for (let k = 0; k < 10; k++) {
        const time = getRandomInt(lastTime + 4, lastTime + 81);
        //console.log('time = ' + time);
        const receiversCount = Math.floor((time - lastTime) / threshold);
        let receivers = [];
        await rewardByTime.setTime(time);
        result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
        if (receiversCount > 0) {
          result.logs[0].event.should.be.equal('Rewarded');
        }
        let i, n;
        for (i = keyIndex, n = 0; n < receiversCount; i++, n++) {
          receivers.push(keysArray[i % keysArray.length]);
          result.logs[0].args.rewards[n].toString().should.be.equal(blockRewardAmount.toString());
        }
        if (receiversCount > 0) {
          receivers.push(emissionFundsAddress);
          result.logs[0].args.receivers.should.be.deep.equal(receivers);
          result.logs[0].args.rewards[n].toString().should.be.equal((emissionFundsAmount * receiversCount).toString());
          lastTime = lastTime + threshold * receiversCount;
          keyIndex = i % keysArray.length;
          (await rewardByTime.lastTime.call()).should.be.bignumber.equal(lastTime);
          (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(keyIndex);
        }
      }
    });

    it('should work fine after some validators are removed and added', async () => {
      await rewardByTime.setSystemAddress(systemAddress);
      let result;
      
      await rewardByTime.setTime(100);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([masterOfCeremony, emissionFundsAddress]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(1);

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey2,
        payoutKey3
      ]);
      result = await keysManager.removeMiningKey(miningKey2, {from: votingToChangeKeys});
      result.logs[0].event.should.equal("MiningKeyChanged");
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey2,
        payoutKey3
      ]);

      await rewardByTime.setTime(107);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100 + threshold);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(2);

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey2,
        payoutKey3
      ]);

      await rewardByTime.setTime(123);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([
        payoutKey2,
        payoutKey3,
        masterOfCeremony,
        emissionFundsAddress
      ]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[3].toString().should.be.equal((emissionFundsAmount * 3).toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100 + threshold * 4);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(1);

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey3
      ]);

      await rewardByTime.setTime(135);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([
        payoutKey,
        payoutKey3,
        masterOfCeremony,
        emissionFundsAddress
      ]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[3].toString().should.be.equal((emissionFundsAmount * 3).toString());
      (await rewardByTime.lastTime.call()).should.be.bignumber.equal(100 + threshold * 7);
      (await rewardByTime.keyIndex.call()).should.be.bignumber.equal(1);

      await addMiningKey(miningKey2);
      await addPayoutKey(payoutKey2, miningKey2);
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey3
      ]);

      await rewardByTime.setTime(147);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([
        payoutKey,
        payoutKey3,
        emissionFundsAddress
      ]);

      (await rewardByTime.getPayoutKeys.call()).should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey3,
        payoutKey2
      ]);

      await rewardByTime.setTime(166);
      result = await rewardByTime.reward({from: systemAddress}).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([
        masterOfCeremony,
        payoutKey,
        payoutKey3,
        payoutKey2,
        emissionFundsAddress
      ]);
    });
  });

  describe('#upgradeTo', async () => {
    const proxyStorageStubAddress = accounts[8];
    it('may be called only by ProxyStorage', async () => {
      const rewardByTimeNew = await RewardByTimeNew.new();
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await rewardByTimeEternalStorage.upgradeTo(rewardByTimeNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(rewardByTimeNew.address, {from: proxyStorageStubAddress});
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorage.address);
    });
    it('should change implementation address', async () => {
      let rewardByTimeNew = await RewardByTimeNew.new();
      const oldImplementation = await rewardByTime.implementation.call();
      const newImplementation = rewardByTimeNew.address;
      (await rewardByTimeEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByTimeNew = await RewardByTimeNew.at(rewardByTimeEternalStorage.address);
      (await rewardByTimeNew.implementation.call()).should.be.equal(newImplementation);
      (await rewardByTimeEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let rewardByTimeNew = await RewardByTimeNew.new();
      const oldVersion = await rewardByTime.version.call();
      const newVersion = oldVersion.add(1);
      (await rewardByTimeEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(rewardByTimeNew.address, {from: proxyStorageStubAddress});
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByTimeNew = await RewardByTimeNew.at(rewardByTimeEternalStorage.address);
      (await rewardByTimeNew.version.call()).should.be.bignumber.equal(newVersion);
      (await rewardByTimeEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let rewardByTimeNew = await RewardByTimeNew.new();
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(rewardByTimeNew.address, {from: proxyStorageStubAddress});
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorage.address);
      rewardByTimeNew = await RewardByTimeNew.at(rewardByTimeEternalStorage.address);
      (await rewardByTimeNew.initialized.call()).should.be.equal(false);
      await rewardByTimeNew.initialize();
      (await rewardByTimeNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let rewardByTimeNew = await RewardByTimeNew.new();
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorageStubAddress);
      await upgradeTo(rewardByTimeNew.address, {from: proxyStorageStubAddress});
      rewardByTimeNew = await RewardByTimeNew.at(rewardByTimeEternalStorage.address);
      (await rewardByTimeNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
      await rewardByTimeEternalStorage.setProxyStorage(proxyStorage.address);
    });
  });
});

async function addMiningKey(_key) {
  const {logs} = await keysManager.addMiningKey(_key, {from: votingToChangeKeys});
  logs[0].event.should.be.equal("MiningKeyChanged");
}

async function addPayoutKey(_key, _miningKey) {
  const {logs} = await keysManager.addPayoutKey(_key, _miningKey, {from: votingToChangeKeys});
  logs[0].event.should.be.equal("PayoutKeyChanged");
}

async function upgradeTo(implementation, options) {
  const {logs} = await rewardByTimeEternalStorage.upgradeTo(implementation, options);
  logs[0].event.should.be.equal("Upgraded");
}
