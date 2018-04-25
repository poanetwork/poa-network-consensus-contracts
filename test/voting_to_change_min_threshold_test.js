let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let Voting = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
let EternalStorageProxy = artifacts.require('./EternalStorageProxy');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
const moment = require('moment');
const {addValidators} = require('./helpers')


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
contract('VotingToChangeMinThreshold [all features]', function (accounts) {
  votingKey = accounts[2];
  votingKey2 = accounts[3];
  votingKey3 = accounts[5];
  masterOfCeremony = accounts[0];
  miningKeyForVotingKey = accounts[1];
  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony, []);
    proxyStorageMock = await ProxyStorageMock.new(poaNetworkConsensusMock.address);
    keysManager = await KeysManagerMock.new(proxyStorageMock.address, poaNetworkConsensusMock.address, masterOfCeremony, "0x0000000000000000000000000000000000000000");
    
    ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);
    voting = await Voting.new(proxyStorageMock.address);
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      masterOfCeremony,
      voting.address,
      masterOfCeremony,
      ballotsEternalStorage.address,
      masterOfCeremony
    );
    
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init(false).should.be.fulfilled;

    await proxyStorageMock.setVotingContractMock(accounts[0]);
    await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey2, accounts[2]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[4]).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey3, accounts[4]).should.be.fulfilled;

    await keysManager.addMiningKey(accounts[5]).should.be.fulfilled;
    await keysManager.addMiningKey(accounts[6]).should.be.fulfilled;
    await keysManager.addMiningKey(accounts[7]).should.be.fulfilled;

    await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
    await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
  })

  describe('#createBallotToChangeThreshold', async () => {
    let VOTING_START_DATE, VOTING_END_DATE, id;
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      id = await voting.nextBallotId();
    })
    it('happy path', async () => {
      const {logs} = await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 4, "memo",{from: votingKey});
      const startTime = await voting.getStartTime(id.toNumber());
      const endTime = await voting.getEndTime(id.toNumber());
      const keysManagerFromContract = await voting.getKeysManager();
      let votingState = await voting.votingState(id);
      votingState.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE),
        new web3.BigNumber(VOTING_END_DATE),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        false,
        new web3.BigNumber(1),
        new web3.BigNumber(0),
        new web3.BigNumber(3),
        new web3.BigNumber(4),
        miningKeyForVotingKey,
        "memo"
      ])
      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      keysManagerFromContract.should.be.equal(keysManager.address);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.creator.should.be.equal(votingKey);
    })
    it('proposed value should be more than or equal to 3', async () => {
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 2,"memo", {from: votingKey}).should.be.fulfilled.rejectedWith(ERROR_MSG);
    })
    it('proposed value should not be equal to the same value', async () => {
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 3,"memo", {from: votingKey}).should.be.fulfilled.rejectedWith(ERROR_MSG);
    })
    it('should not let create more ballots than the limit', async () => {
      const VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      const VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 4,"memo", {from: votingKey});
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 4,"memo", {from: votingKey});
      // we have 6 validators, so 200 limit / 6 = 33.3 ~ 33
      new web3.BigNumber(33).should.be.bignumber.equal(await voting.getBallotLimitPerValidator());
      await addValidators({proxyStorageMock, keysManager, poaNetworkConsensusMock}); // add 100 validators, so total will be 106 validators
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getBallotLimitPerValidator());
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 4, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#vote', async() => {
    let VOTING_START_DATE, VOTING_END_DATE;
    let id;
    beforeEach(async ()=> {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();

      id = await voting.nextBallotId();
      let validators = await poaNetworkConsensusMock.getValidators();
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, 4, "memo",{from: votingKey});
    })

    it('should let a validator to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(id, choice.accept, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.getProgress(id);
      progress.should.be.bignumber.equal(1);
      let totalVoters = await voting.getTotalVoters(id);
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(1);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
    })
    it('reject vote should be accepted', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.getProgress(id);
      progress.should.be.bignumber.equal(-1);
      let totalVoters = await voting.getTotalVoters(id);
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(2);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
    })

    it('should allow multiple voters to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;

      // add new voter
      await voting.vote(id, choice.reject, {from: votingKey2}).should.be.fulfilled;

      let progress = await voting.getProgress(id);
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters(id);
      totalVoters.should.be.bignumber.equal(2);

      await voting.vote(id, choice.accept, {from: votingKey3}).should.be.fulfilled;

      progress = await voting.getProgress(id);
      progress.should.be.bignumber.equal(-1);

      totalVoters = await voting.getTotalVoters(id);
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
      votingId = await voting.nextBallotId();
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, proposedValue, "memo",{from: votingKey});
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.fulfilled;
      // await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      activeBallotsLength = await voting.activeBallotsLength();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const votingState = await voting.votingState(votingId);
      
      votingState.should.be.deep.equal(
        [
          new web3.BigNumber(VOTING_START_DATE), //uint256 startTime;
          new web3.BigNumber(VOTING_END_DATE), //uint256 endTime
          new web3.BigNumber(1),  //uint256 totalVoters
          new web3.BigNumber(1), //int progress
          true,                   //bool isFinalized
          new web3.BigNumber(3),  //uint8 quorumState
          new web3.BigNumber(0),  //uint256 index
          new web3.BigNumber(3),   //uint256 minThresholdOfVoters
          new web3.BigNumber(proposedValue), // uint256 proposedValue
          miningKeyForVotingKey,  // creator
          "memo"

        ]
      )
      true.should.be.equal(
        await voting.hasAlreadyVoted(votingId, votingKey)
      );

      const minThresholdOfVoters = await ballotsStorage.getBallotThreshold(1);
      minThresholdOfVoters.should.be.bignumber.equal(3);
    });

    it('should change to proposedValue when quorum is reached', async () => {
      let proposedValue = 4;
      votingId = await voting.nextBallotId();
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, proposedValue, "memo", {from: votingKey});

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.reject, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;

      activeBallotsLength = await voting.activeBallotsLength();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const votingState = await voting.votingState(votingId);
      votingState.should.be.deep.equal(
        [
          new web3.BigNumber(VOTING_START_DATE), //uint256 startTime;
          new web3.BigNumber(VOTING_END_DATE), //uint256 endTime
          new web3.BigNumber(3),  //uint256 totalVoters
          new web3.BigNumber(1), //int progress
          true,                   //bool isFinalized
          new web3.BigNumber(2),  //uint8 quorumState
          new web3.BigNumber(0),  //uint256 index
          new web3.BigNumber(3),   //uint256 minThresholdOfVoters
          new web3.BigNumber(proposedValue), // uint256 proposedValue
          miningKeyForVotingKey,  //creator
          "memo"

        ]
      )
      true.should.be.equal(
        await voting.hasAlreadyVoted(votingId, votingKey)
      );
      true.should.be.equal(
        await voting.hasAlreadyVoted(votingId, votingKey2)
      );
      true.should.be.equal(
        await voting.hasAlreadyVoted(votingId, votingKey3)
      );

      const minThresholdOfVoters = await ballotsStorage.getBallotThreshold(1);
      minThresholdOfVoters.should.be.bignumber.equal(proposedValue);

      let votingForKeys = await VotingForKeys.new();
      const votingForKeysEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingForKeys.address);
      votingForKeys = await VotingForKeys.at(votingForKeysEternalStorage.address);
      await votingForKeys.init(false);

      const nextId = await votingForKeys.nextBallotId();
      await votingForKeys.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 3, accounts[1], 1, "memo", {from: votingKey});
      const minThresholdVotingForKeys = await votingForKeys.getMinThresholdOfVoters(nextId);
      minThresholdVotingForKeys.should.be.bignumber.equal(proposedValue);
    })

    it('prevents double finalize', async () => {
      let proposedValue1 = 4;
      let proposedValue2 = 5;
      await voting.createBallotToChangeThreshold(VOTING_START_DATE, VOTING_END_DATE, proposedValue1, "memo",{from: votingKey});

      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9").should.be.fulfilled;
      await keysManager.addMiningKey("0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85d9").should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.createBallotToChangeThreshold(VOTING_START_DATE+2, VOTING_END_DATE+2, proposedValue2, "memo",{from: votingKey});
      await voting.finalize(votingId, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      const activeBallotsLength = await voting.activeBallotsLength();
      votingId = await voting.activeBallots(activeBallotsLength.toNumber() - 2);
      let votingIdForSecond = votingId.add(1);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;
      false.should.be.equal(await voting.hasAlreadyVoted(votingId, votingKey2));
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      false.should.be.equal(await voting.getIsFinalized(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(4).should.be.bignumber.equal(await voting.getProposedValue(votingId));
      true.should.be.equal(await voting.getIsFinalized(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(5).should.be.bignumber.equal(await voting.getProposedValue(votingIdForSecond));
      false.should.be.equal(await voting.getIsFinalized(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.fulfilled;

      new web3.BigNumber(-1).should.be.bignumber.equal(await voting.getProgress(votingIdForSecond))
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getProgress(votingId))
    })

  })
})
