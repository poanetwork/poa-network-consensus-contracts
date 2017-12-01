let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./KeysManagerMock');
let BallotsManagerMock = artifacts.require('./BallotsManagerMock');
let BallotsStorageMock = artifacts.require('./BallotsStorageMock');
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

let keysManager, poaNetworkConsensusMock, ballotsManager,ballotsStorage, voting;
let votingKey, votingKey2, votingKey3;
contract('Voting [all features]', function (accounts) {
  votingKey = accounts[2];
  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(accounts[0]);
    ballotsManager = await BallotsManagerMock.new('0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000');
    keysManager = await KeysManagerMock.new(accounts[0], ballotsManager.address, poaNetworkConsensusMock.address);
    ballotsStorage = await BallotsStorageMock.new(ballotsManager.address);
    await poaNetworkConsensusMock.setKeysManagerMock(keysManager.address);
    await poaNetworkConsensusMock.setBallotsStorageMock(ballotsStorage.address);
    await ballotsManager.setKeysManager(keysManager.address);
    await ballotsManager.setBallotsStorage(ballotsStorage.address);

  })
  describe('#constructor', async () => {
    it('happy path', async () => {
      // uint256 _startTime,
    // uint256 _endTime,
    // address _keysContract,
    // address _affectedKey,
    // uint256 _affectedKeyType,
    // address _miningKey
      const VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      const VOTING_END_DATE = moment.utc().add(30, 'years').unix();
      voting = await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1], accounts[2], 1, accounts[3]);
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
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1], accounts[2], 1, accounts[3]).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = 0
      VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1], accounts[2], 1, accounts[3]).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = 0
      await Voting.new(VOTING_START_DATE, VOTING_END_DATE, accounts[1], accounts[2], 1, accounts[3]).should.be.rejectedWith(ERROR_MSG);
      
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
      
      voting = await Voting.new(VOTING_START_DATE, VOTING_END_DATE, keysManager.address, accounts[2], 1, accounts[3]);
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
    votingKey  = accounts[2];
    votingKey2 = accounts[3];
    votingKey3 = accounts[5];
    let payoutKeyToAdd = accounts[0];
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(30, 'years').unix();
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[2]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[4]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[5], accounts[4]).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);
      
    })
    it('happy path - no action since it didnot meet minimum number of totalVoters', async () => {
      // Ballot to Add Payout Key for miner account[1]
      await ballotsManager.createKeysBallot(VOTING_START_DATE, VOTING_END_DATE, payoutKeyToAdd, 3, accounts[1], 1, {from: votingKey});
      let activeBallotsLength = await ballotsStorage.activeBallotsLength();
      votingContractAddress = await ballotsStorage.activeBallots(activeBallotsLength.toNumber() - 1);
      // console.log(votingContractAddress);
      voting = await Voting.at(votingContractAddress);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;

      await voting.finalize().should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize({from: votingKey}).should.be.fulfilled;
      activeBallotsLength = await ballotsStorage.activeBallotsLength();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.isFinalized());
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("Finalized");
      logs[0].args.voter.should.be.equal(votingKey);

      const ballotState = await ballotsStorage.ballotState(votingContractAddress);
      ballotState.should.be.deep.equal(
        [
          new web3.BigNumber(1),//   uint256 ballotType;
          new web3.BigNumber(0),//   uint256 index;
          new web3.BigNumber(3),//   uint256 minThresholdOfVoters;
          new web3.BigNumber(3) //   uint256 quorumState; [0,1,2,3] = Invalid, InProgress, Accepted, Rejected
        ]
      )

      const keysState = await keysManager.validatorKeys(accounts[1]);
      keysState.should.be.deep.equal(
        [ votingKey,
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false ]
      )
    })

    it('finalize addition of payout key', async () => {
      // Ballot to Add Payout Key for miner account[1]
      await deployAndTestBallot({
        _affectedKey: payoutKeyToAdd,
        _affectedKeyType: 3,
        _miningKey: accounts[1],
        _ballotType: 1,
        expectedResult: 2
      })

      const keysState = await keysManager.validatorKeys(accounts[1]);
      keysState.should.be.deep.equal(
        [ votingKey,
        payoutKeyToAdd,
        true,
        true,
        true ]
      )
    })
    it('finalize addition of VotingKey', async () => {
      let miningKey = accounts[6];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);

      // Ballot to Add Voting Key for miner account[1]
      let votingKeyToAdd = accounts[5];

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: votingKeyToAdd,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 1,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ votingKeyToAdd,
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false ]
      )
      
    })
    it('finalize addition of MiningKey', async () => {
      let miningKey = accounts[6];
      // Ballot to Add Voting Key for miner account[1]
      let votingKeyToAdd = accounts[5];

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: miningKey,
        _affectedKeyType: 1,
        _miningKey: '0x0000000000000000000000000000000000000000',
        _ballotType: 1,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators();
      validators.should.contain(miningKey);
      true.should.be.equal(await poaNetworkConsensusMock.isValidator(miningKey));

    })
    it('finalize removal of MiningKey', async () => {
      let miningKey = accounts[6];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);
      // Ballot to Add Voting Key for miner account[1]
  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: miningKey,
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 2,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators();
      validators.should.not.contain(miningKey);
      false.should.be.equal(await poaNetworkConsensusMock.isValidator(miningKey));
    })
    it('finalize removal of VotingKey', async () => {
      let miningKey = accounts[6];
      let votingKeyToAdd = accounts[5];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addVotingKey(votingKeyToAdd, miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);

      // Ballot to Add Voting Key for miner account[1]

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: votingKeyToAdd,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 2,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
    })
    it('finalize removal of PayoutKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addPayoutKey(affectedKey, miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);

      // Ballot to Add Voting Key for miner account[1]

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 3,
        _miningKey: miningKey,
        _ballotType: 2,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
    })
    
    it('finalize swap of VotingKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addVotingKey(affectedKey, miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);

      // Ballot to Add Voting Key for miner account[1]

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 3,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ affectedKey,
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false ]
      )
    })
    it('finalize swap of PayoutKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addPayoutKey(affectedKey, miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);

      // Ballot to Add Voting Key for miner account[1]

  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 3,
        _miningKey: miningKey,
        _ballotType: 3,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        affectedKey,
        true,
        false,
        true ]
      )
    })
    it('finalize swap of MiningKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await keysManager.setBallotsManager(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.setBallotsManager(ballotsManager.address);
      // Ballot to Add Voting Key for miner account[1]
  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 3,
        expectedResult: 2
      })
      const keysState = await keysManager.validatorKeys(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      const keysStateNew = await keysManager.validatorKeys(affectedKey);
      keysStateNew.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators();
      validators.should.not.contain(miningKey);
      validators.should.contain(affectedKey);
      false.should.be.equal(await poaNetworkConsensusMock.isValidator(miningKey));
      true.should.be.equal(await poaNetworkConsensusMock.isValidator(affectedKey));

    })
  })
});


async function deployAndTestBallot({_affectedKey, _affectedKeyType, _miningKey, _ballotType, expectedResult}) {
  // uint256 _startTime,
  // uint256 _endTime,
  // address _affectedKey,
  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // address _miningKey,
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]
  await ballotsManager.createKeysBallot(VOTING_START_DATE, VOTING_END_DATE, _affectedKey, _affectedKeyType, _miningKey, _ballotType, {from: votingKey});
  const activeBallotsLength = await ballotsStorage.activeBallotsLength();
  votingContractAddress = await ballotsStorage.activeBallots(activeBallotsLength.toNumber() - 1);
  voting = await Voting.at(votingContractAddress);
  await voting.setTime(VOTING_START_DATE);
  await voting.vote(choice.reject, {from: votingKey}).should.be.fulfilled;
  await voting.vote(choice.accept, {from: votingKey2}).should.be.fulfilled;
  await voting.vote(choice.accept, {from: votingKey3}).should.be.fulfilled;

  (await voting.totalVoters()).should.be.bignumber.equal(3);
  false.should.be.equal(await voting.isFinalized());
  await voting.setTime(VOTING_END_DATE + 1);
  const {logs} = await voting.finalize({from: votingKey}).should.be.fulfilled;
  true.should.be.equal(await voting.isFinalized());
  const ballotState = await ballotsStorage.ballotState(votingContractAddress);
  ballotState.should.be.deep.equal(
    [
      new web3.BigNumber(_ballotType),//   uint256 ballotType;
      new web3.BigNumber(0),//   uint256 index;
      new web3.BigNumber(3),//   uint256 minThresholdOfVoters;
      new web3.BigNumber(expectedResult) //   uint256 quorumState; [0,1,2,3] = Invalid, InProgress, Accepted, Rejected
    ]
  )
}