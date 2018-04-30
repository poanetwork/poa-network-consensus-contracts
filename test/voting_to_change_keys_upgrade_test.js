let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let VotingToChangeKeysMock = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let VotingToChangeKeysNew = artifacts.require('./upgradeContracts/VotingToChangeKeysNew');
let BallotsStorage = artifacts.require('./BallotsStorage');
let EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
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

let keysManager, poaNetworkConsensusMock, voting;
let votingKey, votingKey2, votingKey3, miningKeyForVotingKey;
contract('Voting to change keys upgraded [all features]', function (accounts) {
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
    keysManager = await KeysManagerMock.new(proxyStorageMock.address, poaNetworkConsensusMock.address, masterOfCeremony, "0x0000000000000000000000000000000000000000");
    
    let ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    
    voting = await VotingToChangeKeysMock.new();
    const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    voting = await VotingToChangeKeysMock.at(votingEternalStorage.address);
    
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      votingEternalStorage.address,
      masterOfCeremony,
      masterOfCeremony,
      ballotsEternalStorage.address,
      masterOfCeremony
    );

    await ballotsStorage.init(false).should.be.fulfilled;
    await voting.init(false).should.be.fulfilled;

    let votingNew = await VotingToChangeKeysNew.new();
    await votingEternalStorage.setProxyStorage(accounts[6]);
    await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[6]});
    await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
    voting = await VotingToChangeKeysNew.at(votingEternalStorage.address);
  })
  describe('#constructor', async () => {
    it('happy path', async () => {
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      const VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      const VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId();
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo", {from: miningKeyForVotingKey}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo", {from: votingKey});
      const startTime = await voting.getStartTime(id.toNumber());
      const endTime = await voting.getEndTime(id.toNumber());
      const keysManagerFromContract = await voting.getKeysManager();

      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      keysManagerFromContract.should.be.equal(keysManager.address);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.creator.should.be.equal(votingKey);
    })
    it('should not let create voting with invalid duration', async () => {
      let VOTING_START_DATE = moment.utc().add(10, 'days').unix();
      let VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = 0
      VOTING_END_DATE = moment.utc().add(2, 'seconds').unix();
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      VOTING_START_DATE = moment.utc().add(2, 'seconds').unix();
      VOTING_END_DATE = 0
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let create more ballots than the limit', async () => {
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      const VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      const VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo", {from: votingKey});
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo", {from: votingKey});
      new web3.BigNumber(200).should.be.bignumber.equal(await voting.getBallotLimitPerValidator());
      await addValidators({proxyStorageMock, keysManager, poaNetworkConsensusMock}); //add 100 validators, so total will be 101 validator
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getBallotLimitPerValidator());
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[2], 1, "memo", {from: votingKey}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#vote', async() => {
    let VOTING_START_DATE, VOTING_END_DATE;
    let id;
    beforeEach(async ()=> {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      id = await voting.nextBallotId();
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, accounts[1], 1, accounts[1], 1, "memo", {from: votingKey});
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
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);

      // add new voter
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[2]).should.be.fulfilled;
      await voting.vote(id, choice.reject, {from: accounts[4]}).should.be.fulfilled;

      let progress = await voting.getProgress(id);
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters(id);
      totalVoters.should.be.bignumber.equal(2);

      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[5], accounts[3]).should.be.fulfilled;
      await voting.vote(id, choice.accept, {from: accounts[5]}).should.be.fulfilled;

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
    })
    it('happy path - no action since it did not meet minimum number of totalVoters', async () => {
      // Ballot to Add Payout Key for miner account[1]
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, payoutKeyToAdd, 3, accounts[1], 1, "memo", {from: votingKey});
      let activeBallotsLength = await voting.activeBallotsLength();
      votingId = await voting.activeBallots(activeBallotsLength.toNumber() - 1);
      // console.log(votingId);
      await voting.finalize(votingId, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;

      await voting.finalize(votingId).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_END_DATE + 1);
      const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      activeBallotsLength = await voting.activeBallotsLength();
      activeBallotsLength.should.be.bignumber.equal(0);
      true.should.be.equal(await voting.getIsFinalized(votingId));
      // Finalized(msg.sender);
      logs[0].event.should.be.equal("BallotFinalized");
      logs[0].args.voter.should.be.equal(votingKey);

      (await voting.getStartTime(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getAffectedKey(votingId)).should.be.equal(payoutKeyToAdd);
      (await voting.getAffectedKeyType(votingId)).should.be.bignumber.equal(3);
      (await voting.getMiningKey(votingId)).should.be.equal(accounts[1]);
      (await voting.getTotalVoters(votingId)).should.be.bignumber.equal(1);
      (await voting.getProgress(votingId)).should.be.bignumber.equal(-1);
      (await voting.getIsFinalized(votingId)).should.be.equal(true);
      (await voting.getQuorumState(votingId)).should.be.bignumber.equal(3);
      (await voting.getBallotType(votingId)).should.be.bignumber.equal(1);
      (await voting.getIndex(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters(votingId)).should.be.bignumber.equal(3);
      (await voting.getCreator(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo(votingId)).should.be.equal("memo");
      
      true.should.be.equal(
        await voting.hasAlreadyVoted(votingId, votingKey)
      );

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
      const keysState = await keysManager.validatorKeys(miningKey);
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
      true.should.be.equal(await poaNetworkConsensusMock.isValidator(miningKey));
      let validators = await poaNetworkConsensusMock.getValidators();
      await voting.setTime(VOTING_START_DATE - 1);
      await deployAndTestBallot({
        _affectedKey: accounts[5],
        _affectedKeyType: 1,
        _miningKey: miningKey,
        _ballotType: 3,
        
      })
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, miningKey, 1, accounts[5], 3, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      
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
      const keysState = await keysManager.validatorKeys(miningKey);
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
      const keysState = await keysManager.validatorKeys(miningKey);
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
    it('prevent double finalize', async () => {
      let miningKey = accounts[6];
      let affectedKey = accounts[5];
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(miningKey).should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(voting.address);

      await voting.createVotingForKeys(VOTING_START_DATE, VOTING_END_DATE, affectedKey, 1, miningKey, 3, "memo",{from: votingKey});
      await voting.createVotingForKeys(VOTING_START_DATE+2, VOTING_END_DATE+2, affectedKey, 1, miningKey, 2, "memo",{from: votingKey});
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
      new web3.BigNumber(3).should.be.bignumber.equal(await voting.getBallotType(votingId));
      true.should.be.equal(await voting.getIsFinalized(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(2).should.be.bignumber.equal(await voting.getBallotType(votingIdForSecond));
      false.should.be.equal(await voting.getIsFinalized(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.fulfilled;

      new web3.BigNumber(-1).should.be.bignumber.equal(await voting.getProgress(votingIdForSecond))
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getProgress(votingId))
    })
  })
});


async function deployAndTestBallot({_affectedKey, _affectedKeyType, _miningKey, _ballotType}) {
  // uint256 _startTime,
  // uint256 _endTime,
  // address _affectedKey,
  // uint256 _affectedKeyType, [enum KeyTypes {Invalid, MiningKey, VotingKey, PayoutKey}]
  // address _miningKey,
  // uint256 _ballotType [  enum BallotTypes {Invalid, Adding, Removal, Swap} ]
  votingId = await voting.nextBallotId();
  await voting.createVotingForKeys(
    VOTING_START_DATE,
    VOTING_END_DATE,
    _affectedKey,
    _affectedKeyType,
    _miningKey,
    _ballotType,
    "memo",
     {from: votingKey});
  const activeBallotsLength = await voting.activeBallotsLength();
  new web3.BigNumber(_ballotType).should.be.bignumber.equal(await voting.getBallotType(votingId));
  await voting.setTime(VOTING_START_DATE);
  await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;
  false.should.be.equal(await voting.hasAlreadyVoted(votingId, votingKey2));
  await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
  await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;

  (await voting.getTotalVoters(votingId)).should.be.bignumber.equal(3);
  false.should.be.equal(await voting.getIsFinalized(votingId));
  await voting.setTime(VOTING_END_DATE + 1);
  const {logs} = await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
  true.should.be.equal(await voting.getIsFinalized(votingId));
  
  (await voting.getStartTime(votingId)).should.be.bignumber.equal(VOTING_START_DATE);
  (await voting.getEndTime(votingId)).should.be.bignumber.equal(VOTING_END_DATE);
  (await voting.getAffectedKey(votingId)).should.be.equal(_affectedKey);
  (await voting.getAffectedKeyType(votingId)).should.be.bignumber.equal(_affectedKeyType);
  (await voting.getMiningKey(votingId)).should.be.equal(_miningKey);
  (await voting.getTotalVoters(votingId)).should.be.bignumber.equal(3);
  (await voting.getProgress(votingId)).should.be.bignumber.equal(1);
  (await voting.getIsFinalized(votingId)).should.be.equal(true);
  (await voting.getQuorumState(votingId)).should.be.bignumber.equal(2);
  (await voting.getBallotType(votingId)).should.be.bignumber.equal(_ballotType);
  (await voting.getIndex(votingId)).should.be.bignumber.equal(0);
  (await voting.getMinThresholdOfVoters(votingId)).should.be.bignumber.equal(3);
  (await voting.getCreator(votingId)).should.be.equal(miningKeyForVotingKey);
  (await voting.getMemo(votingId)).should.be.equal("memo");
}