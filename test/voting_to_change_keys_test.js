let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let VotingToChangeKeysMock = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let VotingToChangeKeysNew = artifacts.require('./upgradeContracts/VotingToChangeKeysNew');
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

let keysManager, poaNetworkConsensusMock, voting;
let votingKey, votingKey2, votingKey3, miningKeyForVotingKey;
let VOTING_START_DATE, VOTING_END_DATE;
contract('Voting to change keys [all features]', function (accounts) {
  votingKey = accounts[2];
  miningKeyForVotingKey = accounts[1];
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony, []);
    
    proxyStorageMock = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorageMock.address);
    proxyStorageMock = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorageMock.init(poaNetworkConsensusMock.address).should.be.fulfilled;
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);
    
    keysManager = await KeysManagerMock.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, keysManager.address);
    keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;
    
    let ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    
    voting = await VotingToChangeKeysMock.new();
    const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    
    await proxyStorageMock.initializeAddresses(
      keysManagerEternalStorage.address,
      votingEternalStorage.address,
      accounts[0],
      accounts[0],
      accounts[0],
      ballotsEternalStorage.address,
      accounts[0],
      accounts[0]
    );

    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    voting = await VotingToChangeKeysMock.at(votingEternalStorage.address);
    await voting.init(172800).should.be.fulfilled;
  })

  describe('#createBallot', async () => {
    it('happy path', async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.swapMiningKey(accounts[3], accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[3]).should.be.fulfilled;
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      
      await voting.createBallot(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[4],       // _affectedKey
        1,                 // _affectedKeyType (MiningKey)
        accounts[5],       // _miningKey
        1,                 // _ballotType (KeyAdding)
        "memo",            // _memo
        {from: miningKeyForVotingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      
      await voting.createBallot(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _affectedKey
        1,                 // _affectedKeyType (MiningKey)
        accounts[5],       // _miningKey
        1,                 // _ballotType (KeyAdding)
        "memo",            // _memo
        {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      
      const {logs} = await voting.createBallot(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[4],       // _affectedKey
        1,                 // _affectedKeyType (MiningKey)
        accounts[5],       // _miningKey
        1,                 // _ballotType (KeyAdding)
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;
      
      const startTime = await voting.getStartTime.call(id.toNumber());
      const endTime = await voting.getEndTime.call(id.toNumber());
      const keysManagerFromContract = await voting.getKeysManager.call();

      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      keysManagerFromContract.should.be.equal(keysManager.address);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.creator.should.be.equal(votingKey);
    })
    it('should not let create voting with invalid duration', async () => {
      VOTING_START_DATE = moment.utc().add(10, 'days').unix();
      VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = 0
      VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = 0
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let add votingKey for MoC', async () => {
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 2, masterOfCeremony, 1, "memo", {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 2, accounts[2], 1, "memo", {from: votingKey}).should.be.fulfilled;
    })
    it('should not let create more ballots than the limit', async () => {
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[3], 1, accounts[2], 1, "memo", {from: votingKey});
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[3], 1, accounts[2], 1, "memo", {from: votingKey});
      new web3.BigNumber(200).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await addValidators({proxyStorageMock, keysManager, poaNetworkConsensusMock}); //add 100 validators, so total will be 101 validator
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[3], 1, accounts[2], 1, "memo", {from: votingKey}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#createBallotToAddNewValidator', async () => {
    let id;
    beforeEach(async ()=> {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(miningKeyForVotingKey).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, miningKeyForVotingKey).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[6], miningKeyForVotingKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      id = await voting.nextBallotId.call();
    });

    it('happy path', async () => {
      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _newMiningKey
        accounts[4],       // _newVotingKey
        accounts[5],       // _newPayoutKey
        "memo",            // _memo
        {from: miningKeyForVotingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _newMiningKey
        accounts[4],       // _newVotingKey
        accounts[5],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;
      
      (await voting.getKeysManager.call()).should.be.equal(keysManager.address);
      (await voting.getStartTime.call(id)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(id)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getAffectedKey.call(id)).should.be.equal(accounts[3]);
      (await voting.getAffectedKeyType.call(id)).should.be.bignumber.equal(1);
      (await voting.getMiningKey.call(id)).should.be.equal('0x0000000000000000000000000000000000000000');
      (await voting.getMemo.call(id)).should.be.equal('memo');
      (await voting.getNewVotingKey.call(id)).should.be.equal(accounts[4]);
      (await voting.getNewPayoutKey.call(id)).should.be.equal(accounts[5]);
      (await voting.getBallotType.call(id)).should.be.bignumber.equal(1);
      
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.ballotType.should.be.bignumber.equal(1);
      logs[0].args.creator.should.be.equal(votingKey);
    });

    it('deny adding already existed voting key', async () => {
      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _newMiningKey
        votingKey,         // _newVotingKey
        accounts[5],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
    });

    it('deny adding already existed payout key', async () => {
      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _newMiningKey
        accounts[4],       // _newVotingKey
        accounts[6],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.rejectedWith(ERROR_MSG);
      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _newMiningKey
        accounts[4],       // _newVotingKey
        accounts[5],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;
    });

    it('should create validator with all keys after finalization', async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.removePayoutKey(miningKeyForVotingKey).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[3]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[5]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[6], accounts[5]).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[7],       // _newMiningKey
        accounts[8],       // _newVotingKey
        accounts[9],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[4]}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[6]}).should.be.fulfilled;

      (await poaNetworkConsensusMock.isValidator.call(accounts[7])).should.be.equal(false);
      (await keysManager.isMiningActive.call(accounts[7])).should.be.equal(false);
      (await keysManager.isVotingActive.call(accounts[8])).should.be.equal(false);
      (await keysManager.miningKeyByVoting.call(accounts[8])).should.be.equal('0x0000000000000000000000000000000000000000');
      (await keysManager.miningKeyByPayout.call(accounts[9])).should.be.equal('0x0000000000000000000000000000000000000000');

      await voting.setTime(VOTING_END_DATE+1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;

      (await poaNetworkConsensusMock.isValidator.call(accounts[7])).should.be.equal(true);
      (await keysManager.isMiningActive.call(accounts[7])).should.be.equal(true);
      (await keysManager.isVotingActive.call(accounts[8])).should.be.equal(true);
      (await keysManager.miningKeyByVoting.call(accounts[8])).should.be.equal(accounts[7]);
      (await keysManager.miningKeyByPayout.call(accounts[9])).should.be.equal(accounts[7]);

      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(4);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(5);
    });

    it('should allow removing new validator if finalizeChange did not happen', async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.removePayoutKey(miningKeyForVotingKey).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[3]).should.be.fulfilled;
      await keysManager.addMiningKey(accounts[5]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[6], accounts[5]).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.createBallotToAddNewValidator(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[7],       // _newMiningKey
        accounts[8],       // _newVotingKey
        accounts[9],       // _newPayoutKey
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[4]}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[6]}).should.be.fulfilled;

      (await poaNetworkConsensusMock.isValidator.call(accounts[7])).should.be.equal(false);
      (await keysManager.isMiningActive.call(accounts[7])).should.be.equal(false);
      (await keysManager.isVotingActive.call(accounts[8])).should.be.equal(false);
      (await keysManager.miningKeyByVoting.call(accounts[8])).should.be.equal('0x0000000000000000000000000000000000000000');
      (await keysManager.miningKeyByPayout.call(accounts[9])).should.be.equal('0x0000000000000000000000000000000000000000');

      await voting.setTime(VOTING_END_DATE+1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;

      (await poaNetworkConsensusMock.isValidator.call(accounts[7])).should.be.equal(true);
      (await keysManager.isMiningActive.call(accounts[7])).should.be.equal(true);
      (await keysManager.isVotingActive.call(accounts[8])).should.be.equal(true);
      (await keysManager.miningKeyByVoting.call(accounts[8])).should.be.equal(accounts[7]);
      (await keysManager.miningKeyByPayout.call(accounts[9])).should.be.equal(accounts[7]);
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(4);

      VOTING_START_DATE = moment.utc().add(20, 'days').unix();
      VOTING_END_DATE = moment.utc().add(30, 'days').unix();
      id = await voting.nextBallotId.call();

      await voting.createBallot(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[7],       // _affectedKey
        1,                 // _affectedKeyType (MiningKey)
        accounts[7],       // _miningKey
        2,                 // _ballotType (KeyRemoval)
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.accept, {from: votingKey}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[4]}).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[6]}).should.be.fulfilled;

      await voting.setTime(VOTING_END_DATE+1);
      await voting.finalize(id, {from: votingKey}).should.be.fulfilled;

      (await poaNetworkConsensusMock.isValidator.call(accounts[7])).should.be.equal(false);
      (await keysManager.isMiningActive.call(accounts[7])).should.be.equal(false);
      (await keysManager.isVotingActive.call(accounts[8])).should.be.equal(false);
      (await keysManager.isPayoutActive.call(accounts[7])).should.be.equal(false);
      (await keysManager.miningKeyByVoting.call(accounts[8])).should.be.equal('0x0000000000000000000000000000000000000000');
      (await keysManager.miningKeyByPayout.call(accounts[9])).should.be.equal('0x0000000000000000000000000000000000000000');
      (await keysManager.getVotingByMining.call(accounts[7])).should.be.equal('0x0000000000000000000000000000000000000000');
      (await keysManager.getPayoutByMining.call(accounts[7])).should.be.equal('0x0000000000000000000000000000000000000000');
      
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(4);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(4);
    });
  });
  
  describe('#vote', async() => {
    let id;
    beforeEach(async ()=> {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      id = await voting.nextBallotId.call();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[3], 1, accounts[1], 1, "memo", {from: votingKey});
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
    })
    it('should allow multiple voters to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, {from: votingKey}).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);

      // add new voter
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[2]).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: accounts[4]}).should.be.fulfilled;

      let progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(2);

      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[5], accounts[3]).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[5]}).should.be.fulfilled;

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

  describe('#finalize', async () => {
    let votingId;
    votingKey  = accounts[2];
    votingKey2 = accounts[3];
    votingKey3 = accounts[5];
    let payoutKeyToAdd = accounts[0];
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey2, accounts[2]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[4]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey3, accounts[4]).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
    })
    
    it('happy path - no action since it did not meet minimum number of totalVoters', async () => {
      // Ballot to Add Payout Key for miner account[1]
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, payoutKeyToAdd, 3, accounts[1], 1, "memo", {from: votingKey});
      let activeBallotsLength = await voting.activeBallotsLength.call();
      votingId = await voting.activeBallots.call(activeBallotsLength.toNumber() - 1);
      // console.log(votingId);
      await voting.finalize(votingId, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;

      await voting.finalize(votingId).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      (await voting.getStartTime.call(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getAffectedKey.call(votingId)).should.be.equal(payoutKeyToAdd);
      (await voting.getAffectedKeyType.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getMiningKey.call(votingId)).should.be.equal(accounts[1]);
      (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getProgress.call(votingId)).should.be.bignumber.equal(-1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getBallotType.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingId)).should.be.equal("memo");
      
      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey)
      );

      const keysState = await keysManager.validatorKeys.call(accounts[1]);
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
      })

      const keysState = await keysManager.validatorKeys.call(accounts[1]);
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
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      // Ballot to Add Voting Key for miner account[1]
      let votingKeyToAdd = accounts[5];

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: votingKeyToAdd,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 1,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ votingKeyToAdd,
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false ]
      )
    })
    it('cannot create ballot for using previous mining key', async () => {
      await proxyStorageMock.setVotingContractMock(voting.address);
      let miningKey = accounts[6];

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: miningKey,
        _affectedKeyType: 1,
        _miningKey: '0x0000000000000000000000000000000000000000',
        _ballotType: 1,
      })
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      true.should.be.equal(await poaNetworkConsensusMock.isValidator.call(miningKey));
      let validators = await poaNetworkConsensusMock.getValidators.call();
      await voting.setTime(VOTING_START_DATE - 1);
      await deployAndTestBallot({
        _affectedKey: accounts[5],
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 3,
        
      })
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, miningKey, 1, accounts[5], 3, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      
    })
    it('finalize addition of MiningKey', async () => {
      await proxyStorageMock.setVotingContractMock(voting.address);
      let miningKey = accounts[6];

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: miningKey,
        _affectedKeyType: 1,
        _miningKey: '0x0000000000000000000000000000000000000000',
        _ballotType: 1,
        
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators.call();
      validators.should.contain(miningKey);
      true.should.be.equal(await poaNetworkConsensusMock.isValidator.call(miningKey));
    })
    it('finalize removal of MiningKey', async () => {
      let miningKey = accounts[6];
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      // Ballot to Add Voting Key for miner account[1]
      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: miningKey,
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 2,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators.call();
      validators.should.not.contain(miningKey);
      false.should.be.equal(await poaNetworkConsensusMock.isValidator.call(miningKey));
    })
    it('finalize removal of VotingKey', async () => {
      let miningKey = accounts[6];
      let votingKeyToAdd = accounts[5];
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addVotingKey(votingKeyToAdd, miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      // Ballot to Add Voting Key for miner account[1]

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: votingKeyToAdd,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 2,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
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
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addPayoutKey(affectedKey, miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      // Ballot to Add Voting Key for miner account[1]

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 3,
        _miningKey: miningKey,
        _ballotType: 2,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
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
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addVotingKey(affectedKey, miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      // Ballot to Add Voting Key for miner account[1]

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]
      let newVotingKey = accounts[2];
      await deployAndTestBallot({
        _affectedKey: newVotingKey,
        _affectedKeyType: 2,
        _miningKey: miningKey,
        _ballotType: 3,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ newVotingKey,
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false ]
      )
    })
    it('finalize swap of PayoutKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await keysManager.addPayoutKey(affectedKey, miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      // Ballot to Add Voting Key for miner account[1]

      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]
      let newPayoutKey = accounts[2];
      await deployAndTestBallot({
        _affectedKey: newPayoutKey,
        _affectedKeyType: 3,
        _miningKey: miningKey,
        _ballotType: 3,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        newPayoutKey,
        true,
        false,
        true ]
      )
    })
    it('finalize swap of MiningKey', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      // Ballot to Add Voting Key for miner account[1]
      // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
      // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]

      await deployAndTestBallot({
        _affectedKey: affectedKey,
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 3,
      })
      const keysState = await keysManager.validatorKeys.call(miningKey);
      keysState.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      const keysStateNew = await keysManager.validatorKeys.call(affectedKey);
      keysStateNew.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false ]
      )
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators.call();
      validators.should.not.contain(miningKey);
      validators.should.contain(affectedKey);
      false.should.be.equal(await poaNetworkConsensusMock.isValidator.call(miningKey));
      true.should.be.equal(await poaNetworkConsensusMock.isValidator.call(affectedKey));
    })
    it('prevent double finalize', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, affectedKey, 1, miningKey, 3, "memo",{from: votingKey});
      await voting.createBallot(VOTING_START_DATE+2, VOTING_END_DATE+2, affectedKey, 1, miningKey, 2, "memo",{from: votingKey});
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
      new web3.BigNumber(3).should.be.bignumber.equal(await voting.getBallotType.call(votingId));
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(2).should.be.bignumber.equal(await voting.getBallotType.call(votingIdForSecond));
      false.should.be.equal(await voting.getIsFinalized.call(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.fulfilled;

      new web3.BigNumber(-1).should.be.bignumber.equal(await voting.getProgress.call(votingIdForSecond))
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getProgress.call(votingId))
    })

    it('allowed at once after all validators gave their votes', async () => {
      const miningKey = accounts[4];
      const affectedKey = accounts[6];
      await voting.createBallot(
        VOTING_START_DATE, // uint256 _startTime
        VOTING_END_DATE,   // uint256 _endTime
        affectedKey,       // address _affectedKey
        1,                 // uint256 _affectedKeyType (MiningKey)
        miningKey,         // address _miningKey
        3,                 // uint256 _ballotType (KeySwap)
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
        affectedKey,       // address _affectedKey
        1,                 // uint256 _affectedKeyType (MiningKey)
        miningKey,         // address _miningKey
        3,                 // uint256 _ballotType (KeySwap)
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
  })

  describe('#migrate', async () => {
    it('should copy a ballot to the new contract', async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      await voting.createBallot(
        VOTING_START_DATE, // _startTime
        VOTING_END_DATE,   // _endTime
        accounts[3],       // _affectedKey
        1,                 // _affectedKeyType (MiningKey)
        accounts[2],       // _miningKey
        1,                 // _ballotType (KeyAdding)
        "memo",            // _memo
        {from: votingKey}
      ).should.be.fulfilled;

      let votingNew = await VotingToChangeKeysMock.new();
      const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingNew.address);
      votingNew = await VotingToChangeKeysMock.at(votingEternalStorage.address);

      await votingNew.migrateBasicOne(
        id,
        voting.address,
        await voting.getQuorumState.call(id),
        await voting.getIndex.call(id),
        await voting.getCreator.call(id),
        await voting.getMemo.call(id),
        [accounts[3], accounts[4], accounts[5]]
      );

      (await votingNew.getStartTime.call(id)).should.be.bignumber.equal(VOTING_START_DATE);
      (await votingNew.getEndTime.call(id)).should.be.bignumber.equal(VOTING_END_DATE);
      (await votingNew.getAffectedKey.call(id)).should.be.equal(accounts[3]);
      (await votingNew.getAffectedKeyType.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getMiningKey.call(id)).should.be.equal(accounts[2]);
      (await votingNew.getTotalVoters.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getProgress.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getIsFinalized.call(id)).should.be.equal(false);
      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getBallotType.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(3);
      (await votingNew.getCreator.call(id)).should.be.equal(accounts[1]);
      (await votingNew.getMemo.call(id)).should.be.equal("memo");
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[1])).should.be.equal(false);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[2])).should.be.equal(false);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[3])).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[4])).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[5])).should.be.equal(true);
      (await votingNew.hasMiningKeyAlreadyVoted.call(id, accounts[6])).should.be.equal(false);

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
    const proxyStorageStubAddress = accounts[8];
    beforeEach(async () => {
      voting = await VotingToChangeKeysMock.new();
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, voting.address);
      voting = await VotingToChangeKeysMock.at(votingEternalStorage.address);
      await voting.init(172800).should.be.fulfilled;
    });
    it('may be called only by ProxyStorage', async () => {
      let votingNew = await VotingToChangeKeysNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await votingEternalStorage.upgradeTo(votingNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
    });
    it('should change implementation address', async () => {
      let votingNew = await VotingToChangeKeysNew.new();
      let oldImplementation = await voting.implementation.call();
      let newImplementation = votingNew.address;
      (await votingEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await votingEternalStorage.upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeKeysNew.at(votingEternalStorage.address);
      (await votingNew.implementation.call()).should.be.equal(newImplementation);
      (await votingEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let votingNew = await VotingToChangeKeysNew.new();
      let oldVersion = await voting.version.call();
      let newVersion = oldVersion.add(1);
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await votingEternalStorage.upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeKeysNew.at(votingEternalStorage.address);
      (await votingNew.version.call()).should.be.bignumber.equal(newVersion);
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let votingNew = await VotingToChangeKeysNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeKeysNew.at(votingEternalStorage.address);
      (await votingNew.initialized.call()).should.be.equal(false);
      await votingNew.initialize();
      (await votingNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let votingNew = await VotingToChangeKeysNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeKeysNew.at(votingEternalStorage.address);
      (await votingNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      const payoutKeyToAdd = accounts[0];

      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();

      await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, payoutKeyToAdd, 3, accounts[1], 1, "memo", {from: votingKey});

      const activeBallotsLength = await voting.activeBallotsLength.call();
      const votingId = await voting.activeBallots.call(activeBallotsLength.toNumber() - 1);

      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;

      await voting.setTime(VOTING_END_DATE + 1);
      await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;

      await votingEternalStorage.setProxyStorage(proxyStorageStubAddress);

      let votingNew = await VotingToChangeKeysNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
      votingNew = await VotingToChangeKeysNew.at(votingEternalStorage.address);

      (await votingNew.getStartTime.call(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
      (await votingNew.getEndTime.call(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
      (await votingNew.getAffectedKey.call(votingId)).should.be.equal(payoutKeyToAdd);
      (await votingNew.getAffectedKeyType.call(votingId)).should.be.bignumber.equal(3);
      (await votingNew.getMiningKey.call(votingId)).should.be.equal(accounts[1]);
      (await votingNew.getTotalVoters.call(votingId)).should.be.bignumber.equal(1);
      (await votingNew.getProgress.call(votingId)).should.be.bignumber.equal(-1);
      (await votingNew.getIsFinalized.call(votingId)).should.be.equal(true);
      (await votingNew.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await votingNew.getBallotType.call(votingId)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);
      (await votingNew.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await votingNew.getMemo.call(votingId)).should.be.equal("memo");
    });
  });
});


async function deployAndTestBallot({_affectedKey, _affectedKeyType, _miningKey, _ballotType}) {
  // uint256 _startTime,
  // uint256 _endTime,
  // address _affectedKey,
  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // address _miningKey,
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]
  votingId = await voting.nextBallotId.call();
  await voting.createBallot(
    VOTING_START_DATE,
    VOTING_END_DATE,
    _affectedKey,
    _affectedKeyType,
    _miningKey,
    _ballotType,
    "memo",
     {from: votingKey});
  const activeBallotsLength = await voting.activeBallotsLength.call();
  new web3.BigNumber(_ballotType).should.be.bignumber.equal(await voting.getBallotType.call(votingId));
  await voting.setTime(VOTING_START_DATE);
  await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;
  false.should.be.equal(await voting.hasAlreadyVoted.call(votingId, votingKey2));
  await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
  await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;

  (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(3);
  false.should.be.equal(await voting.getIsFinalized.call(votingId));
  await voting.setTime(VOTING_END_DATE + 1);
  const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
  true.should.be.equal(await voting.getIsFinalized.call(votingId));
  
  (await voting.getStartTime.call(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
  (await voting.getEndTime.call(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
  (await voting.getAffectedKey.call(votingId)).should.be.equal(_affectedKey);
  (await voting.getAffectedKeyType.call(votingId)).should.be.bignumber.equal(_affectedKeyType);
  (await voting.getMiningKey.call(votingId)).should.be.equal(_miningKey);
  (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(3);
  (await voting.getProgress.call(votingId)).should.be.bignumber.equal(1);
  (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
  (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
  (await voting.getBallotType.call(votingId)).should.be.bignumber.equal(_ballotType);
  (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
  (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(3);
  (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
  (await voting.getMemo.call(votingId)).should.be.equal("memo");
}