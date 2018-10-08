const RewardByBlock = artifacts.require('./mockContracts/RewardByBlockMock');
const RewardByBlockNew = artifacts.require('./upgradeContracts/RewardByBlockNew');
const EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const KeysManager = artifacts.require('./mockContracts/KeysManagerMock');
const PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
const ProxyStorage = artifacts.require('./mockContracts/ProxyStorageMock');
const ValidatorMetadata = artifacts.require('./ValidatorMetadata');
const {getRandomInt} = require('./utils/helpers');

const ERROR_MSG = 'VM Exception while processing transaction: revert';

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let keysManager;
let votingToChangeKeys;
let rewardByBlock, rewardByBlockEternalStorage;
contract('RewardByBlock upgraded [all features]', function (accounts) {
  let poaNetworkConsensus, proxyStorage;
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

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);

    await proxyStorage.initializeAddresses(
      keysManagerEternalStorage.address,
      votingToChangeKeys,
      accounts[9],
      accounts[9],
      accounts[9],
      accounts[9],
      validatorMetadataEternalStorage.address,
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

    rewardByBlock = await RewardByBlock.new();
    rewardByBlockEternalStorage = await EternalStorageProxy.new(proxyStorage.address, rewardByBlock.address);
    rewardByBlock = await RewardByBlock.at(rewardByBlockEternalStorage.address);

    const rewardByBlockNew = await RewardByBlockNew.new();
    await rewardByBlockEternalStorage.setProxyStorage(accounts[8]);
    const {logs} = await rewardByBlockEternalStorage.upgradeTo(rewardByBlockNew.address, {from: accounts[8]});
    logs[0].event.should.be.equal("Upgraded");
    await rewardByBlockEternalStorage.setProxyStorage(proxyStorage.address);
    rewardByBlock = await RewardByBlockNew.at(rewardByBlockEternalStorage.address);

    blockRewardAmount = web3.toWei(1, 'ether');
    emissionFundsAmount = web3.toWei(1, 'ether');
    emissionFundsAddress = '0x0000000000000000000000000000000000000000';
  });

  describe('#reward', async () => {
    it('may only be called by system address', async () => {
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
      const {logs} = await keysManager.removeMiningKey(miningKey3, {from: votingToChangeKeys});
      logs[0].event.should.equal("MiningKeyChanged");
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
      (await rewardByBlock.mintedForAccount.call(payoutKey)).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedForAccount.call(emissionFundsAddress)).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedForAccountInBlock.call(payoutKey, web3.eth.blockNumber)).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedForAccountInBlock.call(emissionFundsAddress, web3.eth.blockNumber)).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedInBlock.call(web3.eth.blockNumber)).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotally.call()).should.be.bignumber.equal(0);
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
      (await rewardByBlock.mintedForAccount.call(payoutKey)).should.be.bignumber.equal(blockRewardAmount);
      (await rewardByBlock.mintedForAccount.call(emissionFundsAddress)).should.be.bignumber.equal(emissionFundsAmount);
      (await rewardByBlock.mintedForAccountInBlock.call(payoutKey, web3.eth.blockNumber)).should.be.bignumber.equal(blockRewardAmount);
      (await rewardByBlock.mintedForAccountInBlock.call(emissionFundsAddress, web3.eth.blockNumber)).should.be.bignumber.equal(emissionFundsAmount);
      const totalMinted = web3.toBigNumber(blockRewardAmount).plus(emissionFundsAmount);
      (await rewardByBlock.mintedInBlock.call(web3.eth.blockNumber)).should.be.bignumber.equal(totalMinted);
      (await rewardByBlock.mintedTotally.call()).should.be.bignumber.equal(totalMinted);
    });

    it('should assign reward to mining key if payout key is 0', async () => {
      const result = await keysManager.removePayoutKey(
        miningKey,
        {from: votingToChangeKeys}
      );
      result.logs[0].event.should.be.equal("PayoutKeyChanged");

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
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(0);
      await rewardByBlock.addExtraReceiver(2, accounts[2], {from: accounts[1]}).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(3, accounts[3], {from: accounts[1]}).should.be.fulfilled;
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(5);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[3])).should.be.bignumber.equal(0);

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

      (await rewardByBlock.extraReceiverAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiverAmount.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[1])).should.be.bignumber.equal(5);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[3])).should.be.bignumber.equal(0);

      await rewardByBlock.addExtraReceiver(2, accounts[2], {from: accounts[1]}).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(3, accounts[3], {from: accounts[1]}).should.be.fulfilled;
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

      (await rewardByBlock.extraReceiverAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiverAmount.call(accounts[3])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[1])).should.be.bignumber.equal(10);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.mintedTotallyByBridge.call(accounts[3])).should.be.bignumber.equal(0);

      (await rewardByBlock.mintedForAccount.call(payoutKey)).should.be.bignumber.equal(blockRewardAmount * 2);
      (await rewardByBlock.mintedForAccount.call(emissionFundsAddress)).should.be.bignumber.equal(emissionFundsAmount * 2);
      (await rewardByBlock.mintedForAccount.call(accounts[2])).should.be.bignumber.equal(4);
      (await rewardByBlock.mintedForAccount.call(accounts[3])).should.be.bignumber.equal(6);
      
      (await rewardByBlock.mintedForAccountInBlock.call(payoutKey, web3.eth.blockNumber)).should.be.bignumber.equal(blockRewardAmount);
      (await rewardByBlock.mintedForAccountInBlock.call(emissionFundsAddress, web3.eth.blockNumber)).should.be.bignumber.equal(emissionFundsAmount);
      (await rewardByBlock.mintedForAccountInBlock.call(accounts[2], web3.eth.blockNumber)).should.be.bignumber.equal(2);
      (await rewardByBlock.mintedForAccountInBlock.call(accounts[3], web3.eth.blockNumber)).should.be.bignumber.equal(3);
      
      (await rewardByBlock.mintedInBlock.call(web3.eth.blockNumber)).should.be.bignumber.equal(
        web3.toBigNumber(blockRewardAmount).plus(emissionFundsAmount).plus(2).plus(3)
      );
      (await rewardByBlock.mintedTotally.call()).should.be.bignumber.equal(
        web3.toBigNumber(blockRewardAmount).plus(emissionFundsAmount).plus(2).plus(3).mul(2)
      );
    });
  });

  describe('#addExtraReceiver', async () => {
    it('may only be called by bridge contract', async () => {
      await rewardByBlock.addExtraReceiver(1, accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await rewardByBlock.addExtraReceiver(1, accounts[1], {from: accounts[2]}).should.be.fulfilled;
    });

    it('should revert if receiver address is 0x0', async () => {
      await rewardByBlock.addExtraReceiver(
        1,
        '0x0000000000000000000000000000000000000000',
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('should revert if amount is 0', async () => {
      await rewardByBlock.addExtraReceiver(
        0,
        accounts[1],
        {from: accounts[2]}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('can be called repeatedly for the same recipient', async () => {
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(0);
      await rewardByBlock.addExtraReceiver(
        1,
        accounts[1],
        {from: accounts[2]}
      ).should.be.fulfilled;
      await rewardByBlock.addExtraReceiver(
        2,
        accounts[1],
        {from: accounts[3]}
      ).should.be.fulfilled;
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(1);
      (await rewardByBlock.extraReceiverByIndex.call(0)).should.be.equal(accounts[1]);
      (await rewardByBlock.extraReceiverAmount.call(accounts[1])).should.be.bignumber.equal(3);
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(1);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(2);

      await rewardByBlock.setSystemAddress(systemAddress);
      const result = await rewardByBlock.reward(
        [miningKey],
        [0],
        {from: systemAddress}
      ).should.be.fulfilled;
      result.logs[0].event.should.be.equal('Rewarded');
      result.logs[0].args.receivers.should.be.deep.equal([payoutKey, emissionFundsAddress, accounts[1]]);
      result.logs[0].args.rewards[0].toString().should.be.equal(blockRewardAmount.toString());
      result.logs[0].args.rewards[1].toString().should.be.equal(emissionFundsAmount.toString());
      result.logs[0].args.rewards[2].toString().should.be.equal('3');

      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiverAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[1])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.bridgeAmount.call(accounts[3])).should.be.bignumber.equal(0);
    });

    it('should add receivers', async () => {
      (await rewardByBlock.extraReceiverAmount.call(accounts[2])).should.be.bignumber.equal(0);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(0);

      let result = await rewardByBlock.addExtraReceiver(2, accounts[2], {from: accounts[1]}).should.be.fulfilled;
      (await rewardByBlock.extraReceiverByIndex.call(0)).should.be.equal(accounts[2]);
      (await rewardByBlock.extraReceiverAmount.call(accounts[2])).should.be.bignumber.equal(2);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(1);
      result.logs[0].event.should.be.equal('AddedReceiver');
      result.logs[0].args.receiver.should.be.equal(accounts[2]);
      result.logs[0].args.amount.should.be.bignumber.equal(2);
      result.logs[0].args.bridge.should.be.equal(accounts[1]);

      result = await rewardByBlock.addExtraReceiver(3, accounts[3], {from: accounts[1]}).should.be.fulfilled;
      (await rewardByBlock.extraReceiverByIndex.call(0)).should.be.equal(accounts[2]);
      (await rewardByBlock.extraReceiverByIndex.call(1)).should.be.equal(accounts[3]);
      (await rewardByBlock.extraReceiverAmount.call(accounts[2])).should.be.bignumber.equal(2);
      (await rewardByBlock.extraReceiverAmount.call(accounts[3])).should.be.bignumber.equal(3);
      (await rewardByBlock.extraReceiversLength.call()).should.be.bignumber.equal(2);
      result.logs[0].event.should.be.equal('AddedReceiver');
      result.logs[0].args.receiver.should.be.equal(accounts[3]);
      result.logs[0].args.amount.should.be.bignumber.equal(3);
      result.logs[0].args.bridge.should.be.equal(accounts[1]);
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
