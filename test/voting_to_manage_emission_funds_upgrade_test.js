const BallotsStorage = artifacts.require('./BallotsStorage');
const EmissionFunds = artifacts.require('./EmissionFunds');
const EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const KeysManager = artifacts.require('./mockContracts/KeysManagerMock');
const PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
const ProxyStorage = artifacts.require('./mockContracts/ProxyStorageMock');
const ValidatorMetadata = artifacts.require('./ValidatorMetadata');
const VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
const VotingForMinThreshold = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
const VotingForProxy = artifacts.require('./mockContracts/VotingToChangeProxyAddressMock');
const VotingToManageEmissionFunds = artifacts.require('./mockContracts/VotingToManageEmissionFundsMock');
const VotingToManageEmissionFundsNew = artifacts.require('./upgradeContracts/VotingToManageEmissionFundsNew');

const ERROR_MSG = 'VM Exception while processing transaction: revert';

const moment = require('moment');
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

const choice = {
  send: 1,
  burn: 2,
  freeze: 3
}

let coinbase;
let poaNetworkConsensus, masterOfCeremony, proxyStorage, keysManager;
let ballotsStorage, votingForKeysEternalStorage, voting, emissionFunds;
let emissionReleaseTime, emissionReleaseThreshold, distributionThreshold;
let votingKey, votingKey2, votingKey3, votingKey4;
let miningKey, miningKey2, miningKey3, miningKey4;
let emissionFundsInitBalance;
contract('VotingToManageEmissionFunds upgraded [all features]', function (accounts) {
  coinbase = accounts[0];
  masterOfCeremony = accounts[0];
  votingKey = accounts[2];
  votingKey2 = accounts[3];
  votingKey3 = accounts[4];
  votingKey4 = accounts[7];
  miningKey = accounts[1];
  miningKey2 = accounts[5];
  miningKey3 = accounts[6];
  miningKey4 = accounts[8];
  
  beforeEach(async () => {
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
    
    ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorage.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    let votingForKeys = await VotingForKeys.new();
    votingForKeysEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingForKeys.address);
    votingForKeys = await VotingForKeys.at(votingForKeysEternalStorage.address);
    await votingForKeys.init(172800).should.be.fulfilled;

    let votingForMinThreshold = await VotingForMinThreshold.new();
    const votingForMinThresholdEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingForMinThreshold.address);
    votingForMinThreshold = await VotingForMinThreshold.at(votingForMinThresholdEternalStorage.address);
    await votingForMinThreshold.init(172800, 3).should.be.fulfilled;

    let votingForProxy = await VotingForProxy.new();
    const votingForProxyEternalStorage = await EternalStorageProxy.new(proxyStorage.address, votingForProxy.address);
    votingForProxy = await VotingForProxy.at(votingForProxyEternalStorage.address);
    await votingForProxy.init(172800).should.be.fulfilled;

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorage.address, validatorMetadata.address);

    voting = await VotingToManageEmissionFunds.new();
    const votingEternalStorage = await EternalStorageProxy.new(proxyStorage.address, voting.address);
    voting = await VotingToManageEmissionFunds.at(votingEternalStorage.address);
    emissionFunds = await EmissionFunds.new(voting.address);
    emissionReleaseTime = moment.utc().add(10, 'minutes').unix();
    emissionReleaseThreshold = moment.duration(3, 'months').asSeconds();
    distributionThreshold = moment.duration(7, 'days').asSeconds();
    await voting.init(
      emissionFunds.address,
      emissionReleaseTime,
      emissionReleaseThreshold,
      distributionThreshold,
      {from: accounts[8]}
    ).should.be.rejectedWith(ERROR_MSG);
    await voting.init(
      emissionFunds.address,
      emissionReleaseTime,
      emissionReleaseThreshold,
      distributionThreshold
    ).should.be.fulfilled;
    
    await proxyStorage.initializeAddresses(
      keysManagerEternalStorage.address,
      votingForKeysEternalStorage.address,
      votingForMinThresholdEternalStorage.address,
      votingForProxyEternalStorage.address,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address
    );

    (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);

    const coinbaseInitBalance = await web3.eth.getBalance(coinbase);
    const howMuchToSend = web3.toWei(10, 'ether');
    const hash = await web3.eth.sendTransaction({
      from: coinbase,
      to: emissionFunds.address,
      value: howMuchToSend
    });
    const receipt = await web3.eth.getTransactionReceipt(hash);

    (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(howMuchToSend);
    emissionFundsInitBalance = howMuchToSend;
    (await web3.eth.getBalance(coinbase)).should.be.bignumber.equal(coinbaseInitBalance.sub(howMuchToSend).sub(receipt.gasUsed));

    const votingNew = await VotingToManageEmissionFundsNew.new();
    await votingEternalStorage.setProxyStorage(accounts[6]);
    await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[6]});
    await votingEternalStorage.setProxyStorage(proxyStorage.address);
    voting = await VotingToManageEmissionFundsNew.at(votingEternalStorage.address);
  });

  describe('#init', async () => {
    it('should change state correctly', async () => {
      (await voting.distributionThreshold.call()).should.be.bignumber.equal(distributionThreshold);
      (await voting.emissionFunds.call()).should.be.equal(emissionFunds.address);
      (await voting.emissionReleaseThreshold.call()).should.be.bignumber.equal(emissionReleaseThreshold);
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(emissionReleaseTime);
      (await voting.previousBallotFinalized.call()).should.be.equal(true);
      (await voting.initDisabled.call()).should.be.equal(true);
      (await voting.proxyStorage.call()).should.be.equal(proxyStorage.address);
      (await voting.getBallotsStorage.call()).should.be.equal(ballotsStorage.address);
      (await voting.getKeysManager.call()).should.be.equal(keysManager.address);
    });
    it('cannot be called more than once', async () => {
      await voting.init(
        emissionFunds.address,
        emissionReleaseTime,
        emissionReleaseThreshold,
        distributionThreshold
      ).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#createBallot', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    beforeEach(async () => {
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(20, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      voting.setTime(moment.utc().add(15, 'minutes').unix());
    });
    it('happy path', async () => {
      const emissionFundsAmount = await web3.eth.getBalance(emissionFunds.address);
      const {logs} = await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.getStartTime.call(id)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(id)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getSendVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getBurnVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getFreezeVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(0);
      (await voting.getIsFinalized.call(id)).should.be.equal(false);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getReceiver.call(id)).should.be.equal(accounts[5]);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
      (await voting.getCreator.call(id)).should.be.equal(miningKey);
      (await voting.getMemo.call(id)).should.be.equal("memo");
      (await voting.getAmount.call(id)).should.be.bignumber.equal(emissionFundsAmount);
      (await voting.previousBallotFinalized.call()).should.be.equal(false);
      (await voting.nextBallotId.call()).should.be.bignumber.equal(1);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.ballotType.should.be.bignumber.equal(6);
      logs[0].args.creator.should.be.equal(votingKey);
    });
    it('may be called only by valid voting key', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: accounts[3]}
      ).should.be.rejectedWith(ERROR_MSG);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
    });
    it('endTime must be greater than startTime', async () => {
      VOTING_END_DATE = moment.utc().add(19, 'minutes').unix();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('startTime must be greater than current time', async () => {
      VOTING_START_DATE = moment.utc().add(14, 'minutes').unix();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('cannot be called before emission release time', async () => {
      voting.setTime(moment.utc().add(7, 'minutes').unix());
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('ballot cannot last longer than distribution threshold', async () => {
      VOTING_END_DATE = moment.utc().add(8, 'days').unix();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('receiver address should not be 0x0', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, '0x0000000000000000000000000000000000000000', "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      (await voting.nextBallotId.call()).should.be.bignumber.equal(0);
    });
    it('cannot create multiple ballots during the same distribution period', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.nextBallotId.call()).should.be.bignumber.equal(1);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[6], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      (await voting.nextBallotId.call()).should.be.bignumber.equal(1);

      voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.voter.should.be.equal(votingKey);

      voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold + 2;
      VOTING_END_DATE = VOTING_START_DATE + 100;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.nextBallotId.call()).should.be.bignumber.equal(2);
    });
    it('should allow to create new ballot after the next emission release threshold', async () => {
      voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold + 2;
      VOTING_END_DATE = VOTING_START_DATE + 100;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );

      voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;

      voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold*5 + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold*5 - 2;
      VOTING_END_DATE = VOTING_START_DATE + 100;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold*5 + 2;
      VOTING_END_DATE = VOTING_START_DATE + 100;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*5
      );
    });
  });

  describe('#refreshEmissionReleaseTime', async () => {
    it('should not update until the next threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      voting.setTime(moment.utc().add(15, 'minutes').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      voting.setTime(moment.utc().add(2, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
    });
    it('should update to the next threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      voting.setTime(moment.utc().add(4, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
    it('should update to the future threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      voting.setTime(moment.utc().add(7, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*2
      );
    });
  });

  describe('#vote', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    let receiver = accounts[9];
    beforeEach(async () => {
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(20, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
    });

    it('should let a validator to vote', async () => {
      const emissionFundsBalanceOld = await web3.eth.getBalance(emissionFunds.address);
      const receiverBalanceOld = await web3.eth.getBalance(receiver);

      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;

      (await voting.getSendVotes.call(id)).should.be.bignumber.equal(1);
      (await voting.getBurnVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getFreezeVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(1);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey)).should.be.equal(true);
      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.previousBallotFinalized.call()).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);

      logs[0].event.should.be.equal('Vote');
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.decision.should.be.bignumber.equal(choice.send);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
      logs[0].args.voterMiningKey.should.be.equal(miningKey);
      logs[1].event.should.be.equal('BallotFinalized');
      logs[1].args.id.should.be.bignumber.equal(0);
      logs[1].args.voter.should.be.equal(votingKey);

      emissionFundsBalanceOld.should.be.bignumber.equal(await web3.eth.getBalance(emissionFunds.address));
      receiverBalanceOld.should.be.bignumber.equal(await web3.eth.getBalance(receiver));
    });

    it('should allow multiple voters to vote', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE+1);
      await voting.vote(id, choice.burn, {from: votingKey}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE+2);
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;

      (await voting.getAmount.call(id)).should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );
      (await voting.getAmount.call(id)).should.be.bignumber.above(0);

      await voting.setTime(VOTING_START_DATE+3);
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      (await voting.getSendVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getBurnVotes.call(id)).should.be.bignumber.equal(3);
      (await voting.getFreezeVotes.call(id)).should.be.bignumber.equal(0);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(3);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey)).should.be.equal(true);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey2)).should.be.equal(true);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey3)).should.be.equal(true);
      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.previousBallotFinalized.call()).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(3);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
    });

    it('should not let vote by nonvoting key', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote before startTime', async () => {
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote after endTime', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
    });

    it('should not let vote with already voted key', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote with invalid choice', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, 0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(id, 4, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote with invalid id', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(99, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(-3, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote if already finalized', async () => {
      await addValidator(votingKey2, miningKey2);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(false);

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(true);

      await voting.vote(id, choice.send, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_START_DATE + 1);
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);

      id = await voting.nextBallotId.call();
      VOTING_START_DATE += emissionReleaseThreshold;
      VOTING_END_DATE += emissionReleaseThreshold;
      await voting.setTime(VOTING_START_DATE - 5*60);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(true);

      await addValidator(votingKey3, miningKey3);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote with old miningKey', async () => {
      await addValidator(votingKey2, miningKey2);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(false);

      proxyStorage.setVotingContractMock(coinbase);
      await keysManager.swapMiningKey(miningKey3, miningKey).should.be.fulfilled;
      proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      proxyStorage.setVotingContractMock(coinbase);
      await keysManager.swapVotingKey(votingKey3, miningKey3).should.be.fulfilled;
      proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.rejectedWith(ERROR_MSG);

      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(true);

      id = await voting.nextBallotId.call();
      VOTING_START_DATE += emissionReleaseThreshold;
      VOTING_END_DATE += emissionReleaseThreshold;
      await voting.setTime(VOTING_START_DATE - 5*60);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey2}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(false);

      proxyStorage.setVotingContractMock(coinbase);
      await keysManager.swapMiningKey(miningKey, miningKey3).should.be.fulfilled;
      await keysManager.swapVotingKey(votingKey, miningKey).should.be.fulfilled;
      proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      (await voting.getIsFinalized.call(id)).should.be.equal(true);
    });
  });

  describe('#finalize', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    let receiver = accounts[9];
    beforeEach(async () => {
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(20, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
    });

    it('happy path', async () => {
      (await voting.getIsFinalized.call(id)).should.be.equal(false);
      (await voting.previousBallotFinalized.call()).should.be.equal(false);

      await addValidator(votingKey2, miningKey2);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(id, {from: votingKey2}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.previousBallotFinalized.call()).should.be.equal(true);
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );

      logs[0].event.should.be.equal('BallotFinalized');
      logs[0].args.id.should.be.bignumber.equal(id);
      logs[0].args.voter.should.be.equal(votingKey2);
    });

    it('freeze funds if it did not pass minimum voters count', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.burn, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey3}).should.be.fulfilled;

      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('freeze funds if there is no majority of 3 votes', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.freeze, {from: votingKey3}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('freeze funds if there is no majority of 4 votes', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);
      await addValidator(votingKey4, miningKey4);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey4}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('send funds to receiver if most votes are for sending', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);
      await addValidator(votingKey4, miningKey4);

      const receiverInitBalance = await web3.eth.getBalance(receiver);

      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;
      await voting.vote(id, choice.freeze, {from: votingKey4}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(2);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(emissionFundsInitBalance)
      );
    });

    it('send funds to receiver if most votes are for sending', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      const receiverInitBalance = await web3.eth.getBalance(receiver);

      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(2);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(3);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(emissionFundsInitBalance)
      );
    });

    it('burn funds if most votes are for burning', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      const receiverInitBalance = await web3.eth.getBalance(receiver);

      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.above(0);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(3);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(3);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(receiverInitBalance);
    });

    it('prevents finalize with invalid id', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(1, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('do not let finalize if a ballot is active', async () => {
      await voting.setTime(VOTING_START_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('finalize immediately if the last validator gave their vote', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      (await voting.getIsFinalized.call(id)).should.be.equal(true);
      (await voting.previousBallotFinalized.call()).should.be.equal(true);
    });

    it('prevents double finalize', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      await voting.finalize(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should refresh emission release time', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
  });
});

async function addValidator(votingKey, miningKey) {
  proxyStorage.setVotingContractMock(coinbase);
  await keysManager.addMiningKey(miningKey).should.be.fulfilled;
  await keysManager.addVotingKey(votingKey, miningKey).should.be.fulfilled;
  proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
  await poaNetworkConsensus.setSystemAddress(coinbase);
  await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
  await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
}