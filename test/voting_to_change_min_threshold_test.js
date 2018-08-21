let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let Voting = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let VotingNew = artifacts.require('./upgradeContracts/VotingToChangeMinThresholdNew');
let VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let BallotsStorage = artifacts.require('./mockContracts/BallotsStorageMock');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
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

let keysManager, poaNetworkConsensusMock, ballotsStorage, voting, votingEternalStorage;
let votingKey, votingKey2, votingKey3, miningKeyForVotingKey;
let VOTING_START_DATE, VOTING_END_DATE;
contract('VotingToChangeMinThreshold [all features]', function (accounts) {
  beforeEach(async () => {
    votingKey = accounts[3];
    votingKey2 = accounts[5];
    votingKey3 = accounts[6];
    masterOfCeremony = accounts[0];
    miningKeyForVotingKey = accounts[1];

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

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, validatorMetadata.address);
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);
    
    voting = await Voting.new();
    votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    voting = await Voting.at(votingEternalStorage.address);
    await voting.init(172800, 0).should.be.rejectedWith(ERROR_MSG);
    await voting.init(172800, 3).should.be.fulfilled;
    await voting.migrateDisable().should.be.fulfilled;
    
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      accounts[0],
      voting.address,
      accounts[0],
      accounts[0],
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address,
      accounts[0]
    );
    
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    await proxyStorageMock.setVotingContractMock(accounts[0]);
    await addMiningKey(miningKeyForVotingKey);
    await addVotingKey(votingKey, miningKeyForVotingKey);

    await addMiningKey(accounts[2]);
    await addVotingKey(votingKey2, accounts[2]);

    await addMiningKey(accounts[4]);
    await addVotingKey(votingKey3, accounts[4]);

    await addMiningKey(accounts[7]);
    await addMiningKey(accounts[8]);
    await addMiningKey(accounts[9]);

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
      const keysManagerFromContract = await voting.getKeysManager.call();
      const ballotInfo = await voting.getBallotInfo.call(id, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        new web3.BigNumber(4), // proposedValue
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);

      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(id)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);

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
      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
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
      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
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

      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(2);

      await voting.vote(id, choice.accept, {from: votingKey3}).should.be.fulfilled;

      progress = (await voting.getBallotInfo.call(id, votingKey))[3];
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
    let payoutKeyToAdd;
    beforeEach(async () => {
      payoutKeyToAdd = accounts[0];
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
      const {logs} = await voting.finalize(votingId, {from: votingKey});
      activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const ballotInfo = await voting.getBallotInfo.call(votingId, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(1), // totalVoters
        new web3.BigNumber(1), // progress
        true, // isFinalized
        new web3.BigNumber(proposedValue), // proposedValue
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);

      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);

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
      const {logs} = await voting.finalize(votingId, {from: votingKey});

      activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const ballotInfo = await voting.getBallotInfo.call(votingId, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(3), // totalVoters
        new web3.BigNumber(1), // progress
        true, // isFinalized
        new web3.BigNumber(proposedValue), // proposedValue
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);

      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);

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
      await votingForKeys.migrateDisable();

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
      await addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9");
      await addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85d9");
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
      false.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      await finalize(votingId, true, {from: votingKey});
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(4).should.be.bignumber.equal(await voting.getProposedValue.call(votingId));
      true.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(5).should.be.bignumber.equal(await voting.getProposedValue.call(votingIdForSecond));
      false.should.be.equal((await voting.getBallotInfo.call(votingIdForSecond, votingKey))[4]); // isFinalized
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await finalize(votingIdForSecond, true, {from: votingKey});

      new web3.BigNumber(-1).should.be.bignumber.equal((await voting.getBallotInfo.call(votingIdForSecond, votingKey))[3]) // progress
      new web3.BigNumber(1).should.be.bignumber.equal((await voting.getBallotInfo.call(votingId, votingKey))[3]) // progress
    });

    it('allowed at once after all validators gave their votes', async () => {
      let result = await keysManager.removeMiningKey(accounts[7]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      result = await keysManager.removeMiningKey(accounts[8]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      result = await keysManager.removeMiningKey(accounts[9]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.setMinPossibleThreshold(2);
      await voting.createBallot(
        VOTING_START_DATE, // uint256 _startTime
        VOTING_END_DATE,   // uint256 _endTime
        2,                 // uint256 _proposedValue
        "memo",            // string _memo
        {from: votingKey3}
      ).should.be.fulfilled;

      false.should.be.equal((await voting.getBallotInfo.call(0, votingKey3))[4]); // isFinalized

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(0, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(0, choice.reject, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(0, choice.accept, {from: votingKey3}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE+1);
      await voting.finalize(0, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);

      false.should.be.equal((await voting.getBallotInfo.call(0, votingKey2))[4]); // isFinalized

      await voting.setTime(VOTING_START_DATE+172800+1);
      (await voting.getTime.call()).should.be.bignumber.below(VOTING_END_DATE);
      await finalize(0, true, {from: votingKey2});

      true.should.be.equal((await voting.getBallotInfo.call(0, votingKey2))[4]); // isFinalized

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

      false.should.be.equal((await voting.getBallotInfo.call(1, votingKey3))[4]); // isFinalized

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(1, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(1, choice.reject, {from: votingKey2}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE+172800+1);
      (await voting.getTime.call()).should.be.bignumber.below(VOTING_END_DATE);
      await voting.finalize(1, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);

      false.should.be.equal((await voting.getBallotInfo.call(1, votingKey2))[4]); // isFinalized

      await voting.setTime(VOTING_END_DATE+1);
      await finalize(1, true, {from: votingKey2});
      true.should.be.equal((await voting.getBallotInfo.call(1, votingKey2))[4]); // isFinalized
    });

    it('should decrease validator limit only once when calling finalize more than once', async () => {
      let result = await keysManager.removeMiningKey(accounts[7]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      result = await keysManager.removeMiningKey(accounts[8]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      result = await keysManager.removeMiningKey(accounts[9]);
      result.logs[0].event.should.equal("MiningKeyChanged");
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.setMinPossibleThreshold(2);
      await ballotsStorage.setThresholdMock(1, 1);

      votingId = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 2, "memo", {from: votingKey});
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 2, "memo", {from: votingKey});
      (await voting.validatorActiveBallots.call(miningKeyForVotingKey)).should.be.bignumber.equal(2);
      
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;

      await ballotsStorage.setThresholdMock(2, 1);
      await voting.setTime(VOTING_END_DATE + 1);

      result = await voting.finalize(votingId, {from: votingKey});
      result.logs.length.should.be.equal(0);
      (await voting.validatorActiveBallots.call(miningKeyForVotingKey)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(false);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(1);

      result = await voting.finalize(votingId, {from: votingKey});
      result.logs.length.should.be.equal(0);
      (await voting.validatorActiveBallots.call(miningKeyForVotingKey)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(false);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(1);

      await ballotsStorage.setThresholdMock(1, 1);

      result = await voting.finalize(votingId, {from: votingKey});
      result.logs[0].event.should.equal("BallotFinalized");
      (await voting.validatorActiveBallots.call(miningKeyForVotingKey)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
    });
  });

  describe('#migrate', async () => {
    it('should copy a ballot to the new contract', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo", {from: votingKey}).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: votingKey3}).should.be.fulfilled;

      let votingNew = await Voting.new();
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingNew.address);
      votingNew = await Voting.at(votingEternalStorage.address);
      await votingNew.init(172800, 3).should.be.fulfilled;
      await votingNew.setTime(VOTING_START_DATE);

      await votingNew.migrateBasicOne(
        id,
        voting.address,
        [miningKeyForVotingKey, accounts[2], accounts[4]]
      ).should.be.fulfilled;

      const ballotInfo = await votingNew.getBallotInfo.call(id, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(3), // totalVoters
        new web3.BigNumber(-3), // progress
        false, // isFinalized
        new web3.BigNumber(4), // proposedValue
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);

      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);

      (await votingNew.hasMiningKeyAlreadyVoted.call(id, miningKeyForVotingKey)).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[2])).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[4])).should.be.equal(true);

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

  describe('#upgradeTo', async () => {
    let proxyStorageStubAddress;
    let votingOldImplementation;
    beforeEach(async () => {
      proxyStorageStubAddress = accounts[8];
      voting = await Voting.new();
      votingOldImplementation = voting.address;
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, voting.address);
      voting = await Voting.at(votingEternalStorage.address);
      await voting.init(172800, 3).should.be.fulfilled;
      await voting.migrateDisable().should.be.fulfilled;
    });
    it('may only be called by ProxyStorage', async () => {
      let votingNew = await VotingNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
    });
    it('should change implementation address', async () => {
      let votingNew = await VotingNew.new();
      let newImplementation = votingNew.address;
      (await votingEternalStorage.implementation.call()).should.be.equal(votingOldImplementation);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      (await votingEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let votingNew = await VotingNew.new();
      let oldVersion = await votingEternalStorage.version.call();
      let newVersion = oldVersion.add(1);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let votingNew = await VotingNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingNew.at(votingEternalStorage.address);
      (await votingNew.initialized.call()).should.be.equal(false);
      await votingNew.initialize();
      (await votingNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let votingNew = await VotingNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingNew.at(votingEternalStorage.address);
      (await votingNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, 4, "memo", {from: votingKey}).should.be.fulfilled;
      await votingEternalStorage.setProxyStorage(proxyStorageStubAddress);
      let votingNew = await VotingNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingNew.at(votingEternalStorage.address);
      await votingEternalStorage.setProxyStorage(proxyStorageMock.address);

      const ballotInfo = await votingNew.getBallotInfo.call(id, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        new web3.BigNumber(4), // proposedValue
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);

      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
    });
  });
})

async function addMiningKey(_key) {
  const {logs} = await keysManager.addMiningKey(_key);
  logs[0].event.should.be.equal("MiningKeyChanged");
}

async function addVotingKey(_key, _miningKey) {
  const {logs} = await keysManager.addVotingKey(_key, _miningKey);
  logs[0].event.should.be.equal("VotingKeyChanged");
}

async function finalize(_id, _shouldBeSuccessful, options) {
  const result = await voting.finalize(_id, options);
  if (_shouldBeSuccessful) {
    result.logs[0].event.should.be.equal("BallotFinalized");
  } else {
    result.logs.length.should.be.equal(0);
  }
}

async function upgradeTo(implementation, options) {
  const {logs} = await votingEternalStorage.upgradeTo(implementation, options);
  logs[0].event.should.be.equal("Upgraded");
}
