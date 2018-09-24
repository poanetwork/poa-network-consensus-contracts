const BallotsStorage = artifacts.require('./BallotsStorage');
const EmissionFunds = artifacts.require('./EmissionFunds');
const EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const KeysManager = artifacts.require('./mockContracts/KeysManagerMock');
const PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
const ProxyStorage = artifacts.require('./mockContracts/ProxyStorageMock');
const RewardByBlock = artifacts.require('./mockContracts/RewardByBlockMock');
const ValidatorMetadata = artifacts.require('./ValidatorMetadata');
const VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
const VotingForMinThreshold = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
const VotingForProxy = artifacts.require('./mockContracts/VotingToChangeProxyAddressMock');
const VotingToManageEmissionFunds = artifacts.require('./mockContracts/VotingToManageEmissionFundsMock');
const VotingToManageEmissionFundsNew = artifacts.require('./upgradeContracts/VotingToManageEmissionFundsNew');
const VotingKey = artifacts.require('./utilContracts/VotingKey');

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
let ballotsStorage, votingForKeysEternalStorage, voting, votingEternalStorage, emissionFunds;
let emissionReleaseTime, emissionReleaseThreshold, distributionThreshold;
let votingKey, votingKey2, votingKey3, votingKey4;
let miningKey, miningKey2, miningKey3, miningKey4;
let emissionFundsInitBalance;
contract('VotingToManageEmissionFunds [all features]', function (accounts) {
  beforeEach(async () => {
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
    votingEternalStorage = await EternalStorageProxy.new(proxyStorage.address, voting.address);
    voting = await VotingToManageEmissionFunds.at(votingEternalStorage.address);
    emissionFunds = await EmissionFunds.new(voting.address);
    emissionReleaseTime = moment.utc().add(10, 'minutes').unix();
    emissionReleaseThreshold = moment.duration(3, 'months').asSeconds();
    distributionThreshold = moment.duration(7, 'days').asSeconds();
    await voting.init(
      emissionReleaseTime,
      emissionReleaseThreshold,
      distributionThreshold,
      emissionFunds.address,
      {from: accounts[8]}
    ).should.be.rejectedWith(ERROR_MSG);
    await voting.init(
      emissionReleaseTime,
      emissionReleaseThreshold,
      300,
      emissionFunds.address
    ).should.be.rejectedWith(ERROR_MSG);
    await voting.init(
      emissionReleaseTime,
      emissionReleaseThreshold,
      distributionThreshold,
      emissionFunds.address
    ).should.be.fulfilled;

    rewardByBlock = await RewardByBlock.new();
    const rewardByBlockEternalStorage = await EternalStorageProxy.new(proxyStorage.address, rewardByBlock.address);
    rewardByBlock = await RewardByBlock.at(rewardByBlockEternalStorage.address);
    
    await proxyStorage.initializeAddresses(
      keysManagerEternalStorage.address,
      votingForKeysEternalStorage.address,
      votingForMinThresholdEternalStorage.address,
      votingForProxyEternalStorage.address,
      votingEternalStorage.address,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address,
      rewardByBlockEternalStorage.address
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
  });

  describe('#init', async () => {
    it('should change state correctly', async () => {
      (await voting.distributionThreshold.call()).should.be.bignumber.equal(distributionThreshold);
      (await voting.emissionFunds.call()).should.be.equal(emissionFunds.address);
      (await voting.emissionReleaseThreshold.call()).should.be.bignumber.equal(emissionReleaseThreshold);
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(emissionReleaseTime);
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
      (await voting.initDisabled.call()).should.be.equal(true);
      (await voting.proxyStorage.call()).should.be.equal(proxyStorage.address);
      (await voting.getKeysManager.call()).should.be.equal(keysManager.address);
    });
    it('cannot be called more than once', async () => {
      await voting.init(
        emissionReleaseTime,
        emissionReleaseThreshold,
        distributionThreshold,
        emissionFunds.address
      ).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#createBallot', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    beforeEach(async () => {
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(31, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
    });
    it('happy path', async () => {
      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      const emissionFundsAmount = await web3.eth.getBalance(emissionFunds.address);
      const {logs} = await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      const ballotInfo = await voting.getBallotInfo.call(id);
      ballotInfo.should.be.deep.equal([
        await voting.getTime.call(), // creationTime
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        false, // isCanceled
        false, // isFinalized
        miningKey, // creator
        "memo", // memo
        new web3.BigNumber(emissionFundsAmount), // amount
        new web3.BigNumber(0), // burnVotes
        new web3.BigNumber(0), // freezeVotes
        new web3.BigNumber(0), // sendVotes
        accounts[5] // receiver
      ]);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(2);
      (await voting.getEmissionReleaseTimeSnapshot.call(id)).should.be.bignumber.equal(emissionReleaseTime);

      (await voting.noActiveBallotExists.call()).should.be.equal(false);
      (await voting.nextBallotId.call()).should.be.bignumber.equal(1);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.ballotType.should.be.bignumber.equal(6);
      logs[0].args.creator.should.be.equal(votingKey);
    });
    it('may only be called by valid voting key', async () => {
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
      await voting.setTime(moment.utc().add(7, 'minutes').unix());
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

      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.voter.should.be.equal(votingKey);

      await voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold + 2;
      VOTING_END_DATE = VOTING_START_DATE + 100;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.nextBallotId.call()).should.be.bignumber.equal(2);
      (await voting.getEmissionReleaseTimeSnapshot.call(1)).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
    it('should allow creating new ballot after the next emission release threshold', async () => {
      await voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold + 2;
      VOTING_END_DATE = VOTING_START_DATE + 900;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
      (await voting.getEmissionReleaseTimeSnapshot.call(0)).should.be.bignumber.equal(
        emissionReleaseTime
      );

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;

      await voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold*5 + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold*5 - 2;
      VOTING_END_DATE = VOTING_START_DATE + 900;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold*5 + 2;
      VOTING_END_DATE = VOTING_START_DATE + 900;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*5
      );
      (await voting.getEmissionReleaseTimeSnapshot.call(1)).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*2
      );
    });
  });

  describe('#cancelNewBallot', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    beforeEach(async () => {
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(31, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
    });
    it('happy path', async () => {
      const emissionFundsAmount = await web3.eth.getBalance(emissionFunds.address);

      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      let creationTime = await voting.getTime.call();

      await voting.setTime(moment.utc().add(20, 'minutes').unix());
      let result = await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("BallotCanceled");
      result.logs[0].args.id.should.be.bignumber.equal(id);
      result.logs[0].args.votingKey.should.be.equal(votingKey);

      let ballotInfo = await voting.getBallotInfo.call(id);
      ballotInfo.should.be.deep.equal([
        creationTime, // creationTime
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        true, // isCanceled
        false, // isFinalized
        miningKey, // creator
        "memo", // memo
        new web3.BigNumber(emissionFundsAmount), // amount
        new web3.BigNumber(0), // burnVotes
        new web3.BigNumber(0), // freezeVotes
        new web3.BigNumber(0), // sendVotes
        accounts[5] // receiver
      ]);
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(emissionReleaseTime);

      id = await voting.nextBallotId.call();
      creationTime = moment.utc().add(22, 'minutes').unix();
      await voting.setTime(creationTime);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.freeze, {from: votingKey}).should.be.fulfilled;
      (await voting.noActiveBallotExists.call()).should.be.equal(false);

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;

      ballotInfo = await voting.getBallotInfo.call(id);
      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(creationTime), // creationTime
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        false, // isCanceled
        true, // isFinalized
        miningKey, // creator
        "memo", // memo
        new web3.BigNumber(emissionFundsAmount), // amount
        new web3.BigNumber(0), // burnVotes
        new web3.BigNumber(1), // freezeVotes
        new web3.BigNumber(0), // sendVotes
        accounts[5] // receiver
      ]);

      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
    it('cannot cancel nonexistent or finalized ballot', async () => {
      await voting.cancelNewBallot({from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;

      await voting.setTime(moment.utc().add(20, 'minutes').unix());
      await voting.cancelNewBallot({from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
    it('may only be called by creator of a ballot', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(moment.utc().add(20, 'minutes').unix());
      await voting.cancelNewBallot({from: votingKey2}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      logs[0].event.should.be.equal("BallotCanceled");
      logs[0].args.id.should.be.bignumber.equal(id);
      logs[0].args.votingKey.should.be.equal(votingKey);
    });
    it('may only be called within ballot canceling threshold', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(moment.utc().add(31, 'minutes').unix());
      await voting.cancelNewBallot({from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await voting.setTime(moment.utc().add(29, 'minutes').unix());
      await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
    });
    it('cannot cancel already cancelled ballot', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(moment.utc().add(29, 'minutes').unix());
      await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      await voting.cancelNewBallot({from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
    it('should restore emission release time', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );

      await voting.setTime(
        emissionReleaseTime + emissionReleaseThreshold*5 + 1
      );
      VOTING_START_DATE = emissionReleaseTime + emissionReleaseThreshold*5 + 2;
      VOTING_END_DATE = VOTING_START_DATE + 900;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*5
      );
      (await voting.getEmissionReleaseTimeSnapshot.call(1)).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );

      await voting.setTime(emissionReleaseTime + emissionReleaseThreshold*5 + 10);
      await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
  });

  describe('#refreshEmissionReleaseTime', async () => {
    it('should not update until the next threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(moment.utc().add(2, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
    });
    it('should update to the next threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(moment.utc().add(4, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });
    it('should update to the future threshold', async () => {
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(moment.utc().add(7, 'months').unix());
      await voting.refreshEmissionReleaseTime();
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold*2
      );
    });
  });

  describe('#vote', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    let receiver;
    beforeEach(async () => {
      receiver = accounts[9];
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(31, 'minutes').unix();
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
      const {logs} = await voting.vote(id, choice.freeze, {from: votingKey}).should.be.fulfilled;

      const ballotInfo = await voting.getBallotInfo.call(id);

      ballotInfo[4].should.be.equal(true); // isFinalized
      ballotInfo[8].should.be.bignumber.equal(0); // burnVotes
      ballotInfo[9].should.be.bignumber.equal(1); // freezeVotes
      ballotInfo[10].should.be.bignumber.equal(0); // sendVotes
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);
      (await voting.hasAlreadyVoted.call(id, votingKey)).should.be.equal(true);

      logs[0].event.should.be.equal('Vote');
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.decision.should.be.bignumber.equal(choice.freeze);
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

      const ballotInfo = await voting.getBallotInfo.call(id);

      ballotInfo[4].should.be.equal(true); // isFinalized
      ballotInfo[8].should.be.bignumber.equal(3); // burnVotes
      ballotInfo[9].should.be.bignumber.equal(0); // freezeVotes
      ballotInfo[10].should.be.bignumber.equal(0); // sendVotes

      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey)).should.be.equal(true);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey2)).should.be.equal(true);
      (await voting.hasMiningKeyAlreadyVoted.call(id, miningKey3)).should.be.equal(true);
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
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
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

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

      await voting.setTime(VOTING_START_DATE + 11*60);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await addValidator(votingKey3, miningKey3);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should not let vote with old miningKey', async () => {
      await addValidator(votingKey2, miningKey2);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await proxyStorage.setVotingContractMock(coinbase);
      const {logs} = await keysManager.swapMiningKey(miningKey3, miningKey);
      logs[0].event.should.equal("MiningKeyChanged");
      await proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await proxyStorage.setVotingContractMock(coinbase);
      await swapVotingKey(votingKey3, miningKey3);
      await proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.rejectedWith(ERROR_MSG);

      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      id = await voting.nextBallotId.call();
      VOTING_START_DATE += emissionReleaseThreshold;
      VOTING_END_DATE += emissionReleaseThreshold;
      await voting.setTime(VOTING_START_DATE - 5*60);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey2}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE + 11*60);
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.fulfilled;
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await proxyStorage.setVotingContractMock(coinbase);
      let result = await keysManager.swapMiningKey(miningKey, miningKey3);
      result.logs[0].event.should.equal("MiningKeyChanged");
      await swapVotingKey(votingKey, miningKey);
      await proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
      await poaNetworkConsensus.setSystemAddress(coinbase);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
    });

    it('should not let vote if ballot is canceled', async () => {
      await voting.setTime(moment.utc().add(20, 'minutes').unix());
      const {logs} = await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      logs[0].event.should.be.equal("BallotCanceled");

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#finalize', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    let receiver;
    beforeEach(async () => {
      receiver = accounts[9];
      await addValidator(votingKey, miningKey);
      VOTING_START_DATE = moment.utc().add(31, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      id = await voting.nextBallotId.call();
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
    });

    it('happy path', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.noActiveBallotExists.call()).should.be.equal(false);

      await addValidator(votingKey2, miningKey2);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(id, {from: votingKey2}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
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

      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(2);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.burn, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey3}).should.be.fulfilled;

      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('freeze funds if there is no majority of 3 votes', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.freeze, {from: votingKey3}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('freeze funds if there is no majority of 4 votes', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);
      await addValidator(votingKey4, miningKey4);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey3}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey4}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(4);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);
      emissionFundsInitBalance.should.be.bignumber.above(0);
    });

    it('send funds to receiver if most votes are for sending', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

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

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(2);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(4);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(emissionFundsInitBalance)
      );
    });

    it('send funds to receiver if most votes are for sending', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      const receiverInitBalance = await web3.eth.getBalance(receiver);

      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(emissionFundsInitBalance);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.send, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(2);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(3);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(emissionFundsInitBalance)
      );
    });

    it('burn funds if most votes are for burning', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      const receiverInitBalance = await web3.eth.getBalance(receiver);

      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.above(0);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(3);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(3);
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(receiverInitBalance);
    });

    it('prevents finalize with invalid id', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(1, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('do not let finalize if a ballot is active', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
      await voting.setTime(VOTING_START_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('finalize immediately if the last validator gave his vote', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      
      (await voting.noActiveBallotExists.call()).should.be.equal(true);
    });

    it('does not finalize immediately until ballot canceling threshold is reached', async () => {
      VOTING_START_DATE = moment.utc().add(17, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(20, 'minutes').unix();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await addValidator(votingKey2, miningKey2);
      await addValidator(votingKey3, miningKey3);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.send, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.burn, {from: votingKey3}).should.be.fulfilled;
      
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await voting.setTime(moment.utc().add(31, 'minutes').unix());
      await voting.finalize(id, {from: votingKey3}).should.be.fulfilled;

      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
    });

    it('prevents double finalize', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      await voting.finalize(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });

    it('should refresh emission release time', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime
      );
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(0, {from: votingKey}).should.be.fulfilled;
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });

    it('deny finalization if the voting key is a contract', async () => {
      const voter = await VotingKey.new(voting.address);
      votingKey2 = voter.address;

      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized
      (await voting.noActiveBallotExists.call()).should.be.equal(false);

      await addValidator(votingKey2, miningKey2);
      await voting.setTime(VOTING_END_DATE + 1);
      
      await voter.callFinalize(id).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;
      true.should.be.equal((await voting.getBallotInfo.call(id))[4]); // isFinalized

      (await voting.noActiveBallotExists.call()).should.be.equal(true);
      (await voting.emissionReleaseTime.call()).should.be.bignumber.equal(
        emissionReleaseTime + emissionReleaseThreshold
      );
    });

    it('deny finalization within ballot canceling threshold', async () => {
      VOTING_START_DATE = moment.utc().add(17, 'minutes').unix();
      VOTING_END_DATE = moment.utc().add(20, 'minutes').unix();
      
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      await voting.setTime(moment.utc().add(31, 'minutes').unix());
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;
    });

    it('deny finalization of canceled ballot', async () => {
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(moment.utc().add(20, 'minutes').unix());
      let result = await voting.cancelNewBallot({from: votingKey}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("BallotCanceled");
      result.logs[0].args.id.should.be.bignumber.equal(id);
      result.logs[0].args.votingKey.should.be.equal(votingKey);

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(id, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#upgradeTo', async () => {
    let proxyStorageStubAddress;
    let votingOldImplementation;
    beforeEach(async () => {
      proxyStorageStubAddress = accounts[8];
      voting = await VotingToManageEmissionFunds.new();
      votingOldImplementation = voting.address;
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, voting.address);
      voting = await VotingToManageEmissionFunds.at(votingEternalStorage.address);
      await voting.init(
        emissionReleaseTime,
        emissionReleaseThreshold,
        distributionThreshold,
        emissionFunds.address
      ).should.be.fulfilled;
    });
    it('may only be called by ProxyStorage', async () => {
      let votingNew = await VotingToManageEmissionFundsNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
    });
    it('should change implementation address', async () => {
      let votingNew = await VotingToManageEmissionFundsNew.new();
      let newImplementation = votingNew.address;
      (await votingEternalStorage.implementation.call()).should.be.equal(votingOldImplementation);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      (await votingEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let votingNew = await VotingToManageEmissionFundsNew.new();
      let oldVersion = await votingEternalStorage.version.call();
      let newVersion = oldVersion.add(1);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let votingNew = await VotingToManageEmissionFundsNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToManageEmissionFundsNew.at(votingEternalStorage.address);
      (await votingNew.initialized.call()).should.be.equal(false);
      await votingNew.initialize();
      (await votingNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let votingNew = await VotingToManageEmissionFundsNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToManageEmissionFundsNew.at(votingEternalStorage.address);
      (await votingNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      await addValidator(votingKey, miningKey);

      const emissionFundsAmount = await web3.eth.getBalance(emissionFunds.address);
      const VOTING_START_DATE = moment.utc().add(31, 'minutes').unix();
      const VOTING_END_DATE = moment.utc().add(7, 'days').unix();
      const id = await voting.nextBallotId.call();
      const receiver = accounts[9];
      await voting.setTime(moment.utc().add(15, 'minutes').unix());
      await votingEternalStorage.setProxyStorage(proxyStorage.address);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, receiver, "memo", {from: votingKey}
      ).should.be.fulfilled;
      await votingEternalStorage.setProxyStorage(proxyStorageStubAddress);

      let votingNew = await VotingToManageEmissionFundsNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToManageEmissionFundsNew.at(votingEternalStorage.address);
      await votingEternalStorage.setProxyStorage(proxyStorage.address);

      const ballotInfo = await votingNew.getBallotInfo.call(id);
      ballotInfo.should.be.deep.equal([
        await voting.getTime.call(), // creationTime
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        false, // isCanceled
        false, // isFinalized
        miningKey, // creator
        "memo", // memo
        new web3.BigNumber(emissionFundsAmount), // amount
        new web3.BigNumber(0), // burnVotes
        new web3.BigNumber(0), // freezeVotes
        new web3.BigNumber(0), // sendVotes
        receiver // receiver
      ]);
      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);
      (await votingNew.noActiveBallotExists.call()).should.be.equal(false);
      (await votingNew.nextBallotId.call()).should.be.bignumber.equal(1);
    });
  });
});

async function addValidator(_votingKey, _miningKey) {
  await proxyStorage.setVotingContractMock(coinbase);
  let result = await keysManager.addMiningKey(_miningKey, {from: coinbase});
  result.logs[0].event.should.be.equal("MiningKeyChanged");
  result = await keysManager.addVotingKey(_votingKey, _miningKey, {from: coinbase});
  result.logs[0].event.should.be.equal("VotingKeyChanged");
  await proxyStorage.setVotingContractMock(votingForKeysEternalStorage.address);
  await poaNetworkConsensus.setSystemAddress(coinbase);
  await poaNetworkConsensus.finalizeChange({from: coinbase}).should.be.fulfilled;
  await poaNetworkConsensus.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE');
}

async function swapVotingKey(_key, _miningKey) {
  const {logs} = await keysManager.swapVotingKey(_key, _miningKey);
  logs[0].event.should.be.equal("VotingKeyChanged");
}

async function upgradeTo(implementation, options) {
  const {logs} = await votingEternalStorage.upgradeTo(implementation, options);
  logs[0].event.should.be.equal("Upgraded");
}
