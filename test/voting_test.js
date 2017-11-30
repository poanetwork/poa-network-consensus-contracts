let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./KeysManagerMock');
let BallotsManagerMock = artifacts.require('./BallotsManagerMock');
let Voting = artifacts.require('./VotingMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
const moment = require('moment');

const choice = {
  accept: 1,
  reject: 2
}
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('Voting [all features]', function (accounts) {
  let keysManager, poaNetworkConsensusMock, ballotsManager, voting;
  const votingKey = accounts[2];
  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(accounts[0]);
    keysManager = await KeysManagerMock.new(accounts[0]);
    await keysManager.setPoaConsensus(poaNetworkConsensusMock.address);
    await poaNetworkConsensusMock.setKeysManagerMock(keysManager.address);
    ballotsManager = await BallotsManagerMock.new(poaNetworkConsensusMock.address);
    await keysManager.setBallotsManager(ballotsManager.address);
    await ballotsManager.setKeysManager(keysManager.address);
  })
  describe('#constructor', async () => {
    it('happy path', async () => {
      
      const VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      const VOTING_END_DATE = moment.utc().add(30, 'years').unix();
      voting = await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1]);
      const startTime = await voting.startTime();
      const endTime = await voting.endTime();
      const keysManager = await voting.keysManager();
      const ballotsManager = await voting.ballotsManager();

      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      keysManager.should.be.bignumber.equal(accounts[1]);
      ballotsManager.should.be.bignumber.equal(accounts[0]);
    })

    it('should not let create voting with invalid duration', async () => {
      let VOTING_START_DATE = moment.utc().add(30, 'years').unix();
      let VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1]).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = 0
      VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1]).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = 0
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1]).should.be.rejectedWith(ERROR_MSG);
      
    })
  })

  describe('#vote', async() => {
    let VOTING_START_DATE, VOTING_END_DATE;

    beforeEach(async ()=> {
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(30, 'years').unix();
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      
      voting = await Voting.new(VOTING_START_DATE, VOTING_END_DATE, keysManager.address);
    })

    it('should let a validator to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(choice.accept, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.progress();
      progress.should.be.bignumber.equal(1);
      let totalVoters = await voting.totalVoters();
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(1);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
    })
    it('reject vote should be accepted', async () => {
      await voting.setTime(VOTING_START_DATE);
      const {logs} = await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;
      let progress = await voting.progress();
      progress.should.be.bignumber.equal(-1);
      let totalVoters = await voting.totalVoters();
      totalVoters.should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Vote');
      logs[0].args.decision.should.be.bignumber.equal(2);
      logs[0].args.voter.should.be.equal(votingKey);
      logs[0].args.time.should.be.bignumber.equal(VOTING_START_DATE);
    })

    it('should allow multiple voters to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await voting.vote(choice.reject, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);

      // add new voter
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[2]).should.be.fulfilled;
      await voting.vote(choice.reject, {from: accounts[4]}).should.be.fulfilled;

      let progress = await voting.progress();
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.totalVoters();
      totalVoters.should.be.bignumber.equal(2);

      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[5], accounts[3]).should.be.fulfilled;
      await voting.vote(choice.accept, {from: accounts[5]}).should.be.fulfilled;

      progress = await voting.progress();
      progress.should.be.bignumber.equal(-1);

      totalVoters = await voting.totalVoters();
      totalVoters.should.be.bignumber.equal(3);
    })
    it('should not let vote nonVoting key', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(choice.reject, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote before startTime key', async () => {
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.vote(choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote after endTime key', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.vote(choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with already voted key', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.vote(choice.reject, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with invalid choice', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(0, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(3, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#finalize', async () => {
    let votingContractAddress;
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(30, 'years').unix();
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      // Ballot to Add Payout Key for miner account[1]
      await ballotsManager.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[0], 3, accounts[1], 1, {from: votingKey});
      const activeBallotsLength = await ballotsManager.activeBallotsLength();
      votingContractAddress = await ballotsManager.activeBallots(activeBallotsLength.toNumber() - 1);

      voting = await Voting.at(votingContractAddress);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;
    })
    it.only('happy path', async () => {
      await voting.finalize().should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize({from: votingKey}).should.be.fulfilled;
      const activeBallotsLength = await ballotsManager.activeBallotsLength();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.isFinalized());
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("Finalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const ballotState = await ballotsManager.ballotState(votingContractAddress);
      // struct Ballot {
      
      //   address affectedKey;
      //   uint256 affectedKeyType;
      //   address miningKey;
      //   uint256 ballotType;
      //   uint256 index;
      // }
      ballotState.should.be.deep.equal(
        [
          false,//   bool isActive;
          accounts[0],
          new web3.BigNumber(3), 
          accounts[1], 
          new web3.BigNumber(1),
          new web3.BigNumber(0)
        ]
      )

    })
  })
});