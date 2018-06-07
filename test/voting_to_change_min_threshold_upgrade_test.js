let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let Voting = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let VotingNew = artifacts.require('./upgradeContracts/VotingToChangeMinThresholdNew');
let VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
let EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
const moment = require('moment');
const {addValidators} = require('./utils/helpers')


const choice = {
  accept: 1,
  reject: 2
}
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let keysManager, poaNetworkConsensusMock, ballotsStorage, voting;
let votingKey, votingKey2, votingKey3, miningKeyForVotingKey;
let VOTING_START_DATE, VOTING_END_DATE;
contract('VotingToChangeMinThreshold upgraded [all features]', function (accounts) {
  votingKey = accounts[3];
  votingKey2 = accounts[5];
  votingKey3 = accounts[6];
  masterOfCeremony = accounts[0];
  miningKeyForVotingKey = accounts[1];
  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony, []);
    
    proxyStorageMock = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorageMock.address);
    proxyStorageMock = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorageMock.init(poaNetworkConsensusMock.address).should.be.fulfilled;
    
    keysManager = await KeysManagerMock.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, keysManager.address);
    keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;
    
    ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);
    
    voting = await Voting.new();
    const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    voting = await Voting.at(votingEternalStorage.address);
    await voting.init(172800, 0).should.be.rejectedWith(ERROR_MSG);
    await voting.init(172800, 3).should.be.fulfilled;

    const votingNew = await VotingNew.new();
    await votingEternalStorage.setProxyStorage(accounts[6]);
    await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[6]});
    await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
    voting = await VotingNew.at(votingEternalStorage.address);
    
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      masterOfCeremony,
      voting.address,
      masterOfCeremony,
      ballotsEternalStorage.address,
      masterOfCeremony
    );
    
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    await proxyStorageMock.setVotingContractMock(accounts[0]);
    await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey2, accounts[2]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[4]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey3, accounts[4]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[7]).should.be.fulfilled;
    await keysManager.addMiningKey(accounts[8]).should.be.fulfilled;
    await keysManager.addMiningKey(accounts[9]).should.be.fulfilled;

    await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
    await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
  })

  describe('#createBallot', async () => {
    let id;
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      id = await voting.nextBallotId.call();
    })
    it('happy path', async () => {
      const {logs} = await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo", {from: votingKey});
      const startTime = await voting.getStartTime.call(id.toNumber());
      const endTime = await voting.getEndTime.call(id.toNumber());
      const keysManagerFromContract = await voting.getKeysManager.call();
      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(0);
      (await voting.getProgress.call(id)).should.be.bignumber.equal(0);
      (await voting.getIsFinalized.call(id)).should.be.equal(false);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(id)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
      (await voting.getProposedValue.call(id)).should.be.bignumber.equal(4);
      (await voting.getCreator.call(id)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(id)).should.be.equal("memo");
      keysManagerFromContract.should.be.equal(keysManager.address);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.creator.should.be.equal(votingKey);
    })
    it('proposed value should be more than or equal to 3', async () => {
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 2,"memo", {from: votingKey}).should.be.fulfilled.rejectedWith(ERROR_MSG);
    })
    it('proposed value should not be equal to the same value', async () => {
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 3,"memo", {from: votingKey}).should.be.fulfilled.rejectedWith(ERROR_MSG);
    })
    it('should not let create more ballots than the limit', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4,"memo", {from: votingKey});
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4,"memo", {from: votingKey});
      // we have 6 validators, so 200 limit / 6 = 33.3 ~ 33
      new web3.BigNumber(33).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await addValidators({proxyStorageMock, keysManager, poaNetworkConsensusMock}); // add 100 validators, so total will be 106 validators
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#vote', async() => {
    let id;
    beforeEach(async ()=> {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();

      id = await voting.nextBallotId.call();
      let validators = await poaNetworkConsensusMock.getValidators.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo",{from: votingKey});
    })

    it('should let a validator to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(id, choice.accept, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(1);
      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(1);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
      logs[0].args.voterMiningKey.should.be.equal(miningKeyForVotingKey);
    })
    it('reject vote should be accepted', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(-1);
      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(2);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
      logs[0].args.voterMiningKey.should.be.equal(miningKeyForVotingKey);
    })

    it('should allow multiple voters to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;

      // add new voter
      await voting.vote(id, choice.reject, {from: votingKey2}).should.be.fulfilled;

      let progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(2);

      await voting.vote(id, choice.accept, {from: votingKey3}).should.be.fulfilled;

      progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(-1);

      totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(3);
    })
    it('should not let vote nonVoting key', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote before startTime key', async () => {
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote after endTime key', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with already voted key', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with invalid choice', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(id, 0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(id, 3, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with invalid id', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(99, 1, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(-3, 1, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#finalize', async() => {
    let votingId;
    let payoutKeyToAdd = accounts[0];
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();      
    })

    it('does not change if it did not pass minimum threshold', async () => {
      let proposedValue = 4;
      votingId = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, proposedValue, "memo", {from: votingKey});
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.fulfilled;
      // await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);
      (await voting.getStartTime.call(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getProgress.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getProposedValue.call(votingId)).should.be.bignumber.equal(proposedValue);
      (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingId)).should.be.equal("memo");

      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey)
      );

      const minThresholdOfVoters = await ballotsStorage.getBallotThreshold.call(1);
      minThresholdOfVoters.should.be.bignumber.equal(3);
    });

    it('should change to proposedValue when quorum is reached', async () => {
      let proposedValue = 4;
      votingId = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, proposedValue, "memo", {from: votingKey});

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.reject, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;

      activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      (await voting.getStartTime.call(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getProgress.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getProposedValue.call(votingId)).should.be.bignumber.equal(proposedValue);
      (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingId)).should.be.equal("memo");

      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey)
      );
      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey2)
      );
      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey3)
      );

      const minThresholdOfVoters = await ballotsStorage.getBallotThreshold.call(1);
      minThresholdOfVoters.should.be.bignumber.equal(proposedValue);

      let votingForKeys = await VotingForKeys.new();
      const votingForKeysEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingForKeys.address);
      votingForKeys = await VotingForKeys.at(votingForKeysEternalStorage.address);
      await votingForKeys.init(172800);

      const nextId = await votingForKeys.nextBallotId.call();
      await votingForKeys.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 3, accounts[1], 1, "memo", {from: votingKey});
      const minThresholdVotingForKeys = await votingForKeys.getMinThresholdOfVoters.call(nextId);
      minThresholdVotingForKeys.should.be.bignumber.equal(proposedValue);
    })

    it('prevents double finalize', async () => {
      let proposedValue1 = 4;
      let proposedValue2 = 5;
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, proposedValue1, "memo",{from: votingKey});

      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9").should.be.fulfilled;
      await keysManager.addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85d9").should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.createBallot(VOTING_START_DATE+2, VOTING_END_DATE+2, proposedValue2, "memo",{from: votingKey});
      await voting.finalize(votingId, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      const activeBallotsLength = await voting.activeBallotsLength.call();
      votingId = await voting.activeBallots.call(activeBallotsLength.toNumber() - 2);
      let votingIdForSecond = votingId.add(1);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;
      false.should.be.equal(await voting.hasAlreadyVoted.call(votingId, votingKey2));
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      false.should.be.equal(await voting.getIsFinalized.call(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(4).should.be.bignumber.equal(await voting.getProposedValue.call(votingId));
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(5).should.be.bignumber.equal(await voting.getProposedValue.call(votingIdForSecond));
      false.should.be.equal(await voting.getIsFinalized.call(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.fulfilled;

      new web3.BigNumber(-1).should.be.bignumber.equal(await voting.getProgress.call(votingIdForSecond))
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getProgress.call(votingId))
    });

    it('allowed at once after all validators gave their votes', async () => {
      await keysManager.removeMiningKey(accounts[7]).should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[8]).should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[9]).should.be.fulfilled;
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.setMinPossibleThreshold(2);
      await voting.createBallot(
        VOTING_START_DATE, // uint256 _startTime
        VOTING_END_DATE,   // uint256 _endTime
        2,                 // uint256 _proposedValue
        "memo",            // string _memo
        {from: votingKey3}
      ).should.be.fulfilled;

      (await voting.getIsFinalized.call(0)).should.be.equal(false);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(0, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(0, choice.reject, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(0, choice.accept, {from: votingKey3}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE+1);
      await voting.finalize(0, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);

      (await voting.getIsFinalized.call(0)).should.be.equal(false);

      await voting.setTime(VOTING_START_DATE+172800+1);
      (await voting.getTime.call()).should.be.bignumber.below(VOTING_END_DATE);
      await voting.finalize(0, {from: votingKey2}).should.be.fulfilled;

      (await voting.getIsFinalized.call(0)).should.be.equal(true);

      await voting.setTime(VOTING_END_DATE+1);
      await voting.finalize(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);

      VOTING_START_DATE = moment.utc().add(12, 'days').unix();
      VOTING_END_DATE = moment.utc().add(22, 'days').unix();

      await voting.createBallot(
        VOTING_START_DATE, // uint256 _startTime
        VOTING_END_DATE,   // uint256 _endTime
        2,                 // uint256 _proposedValue
        "memo",            // string _memo
        {from: votingKey3}
      ).should.be.fulfilled;

      (await voting.getIsFinalized.call(1)).should.be.equal(false);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(1, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(1, choice.reject, {from: votingKey2}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE+172800+1);
      (await voting.getTime.call()).should.be.bignumber.below(VOTING_END_DATE);
      await voting.finalize(1, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);

      (await voting.getIsFinalized.call(1)).should.be.equal(false);

      await voting.setTime(VOTING_END_DATE+1);
      await voting.finalize(1, {from: votingKey2}).should.be.fulfilled;
      (await voting.getIsFinalized.call(1)).should.be.equal(true);
    });
  });

  describe('#migrate', async () => {
    it('should copy a ballot to the new contract', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo", {from: votingKey}).should.be.fulfilled;

      let votingNew = await Voting.new();
      const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingNew.address);
      votingNew = await Voting.at(votingEternalStorage.address);

      await votingNew.migrateBasicOne(
        id,
        voting.address,
        await voting.getQuorumState.call(id),
        await voting.getIndex.call(id),
        await voting.getCreator.call(id),
        await voting.getMemo.call(id),
        [votingKey, votingKey2, votingKey3]
      );

      (await votingNew.getStartTime.call(id)).should.be.bignumber.equal(VOTING_START_DATE);
      (await votingNew.getEndTime.call(id)).should.be.bignumber.equal(VOTING_END_DATE);
      (await votingNew.getTotalVoters.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getProgress.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getIsFinalized.call(id)).should.be.equal(false);
      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
      (await votingNew.getCreator.call(id)).should.be.equal(accounts[1]);
      (await votingNew.getMemo.call(id)).should.be.equal("memo");
      (await votingNew.getProposedValue.call(id)).should.be.bignumber.equal(4);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, votingKey)).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, votingKey2)).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, votingKey3)).should.be.equal(true);

      (await votingNew.nextBallotId.call()).should.be.bignumber.equal(0);
      (await votingNew.activeBallotsLength.call()).should.be.bignumber.equal(0);
      (await votingNew.validatorActiveBallots.call(accounts[1])).should.be.bignumber.equal(0);
      await votingNew.migrateBasicAll(voting.address, {from: accounts[6]}).should.be.rejectedWith(ERROR_MSG);
      await votingNew.migrateBasicAll('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
      await votingNew.migrateBasicAll(voting.address).should.be.fulfilled;
      await votingNew.migrateBasicAll(voting.address).should.be.fulfilled;
      (await votingNew.nextBallotId.call()).should.be.bignumber.equal(1);
      (await votingNew.activeBallotsLength.call()).should.be.bignumber.equal(1);
      (await votingNew.validatorActiveBallots.call(accounts[1])).should.be.bignumber.equal(1);
      (await votingNew.migrateDisabled.call()).should.be.equal(false);
      await votingNew.migrateDisable({from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await votingNew.migrateDisable().should.be.fulfilled;
      (await votingNew.migrateDisabled.call()).should.be.equal(true);
      await votingNew.migrateBasicAll(voting.address).should.be.rejectedWith(ERROR_MSG);
    });
  });
})
