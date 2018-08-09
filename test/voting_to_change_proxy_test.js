let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let VotingToChangeProxyAddress = artifacts.require('./mockContracts/VotingToChangeProxyAddressMock');
let VotingToChangeProxyAddressNew = artifacts.require('./upgradeContracts/VotingToChangeProxyAddressNew');
let VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let VotingForMinThreshold = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let VotingForEmissionFunds = artifacts.require('./mockContracts/VotingToManageEmissionFundsMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
let ValidatorMetadata = artifacts.require('./ValidatorMetadata');
let RewardByBlock = artifacts.require('./RewardByBlock');
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
let votingForKeysEternalStorage;
let VOTING_START_DATE, VOTING_END_DATE;
contract('VotingToChangeProxyAddress [all features]', function (accounts) {
  beforeEach(async () => {
    votingKey = accounts[2];
    masterOfCeremony = accounts[0];
    miningKeyForVotingKey = accounts[1];

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
    
    ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;

    let votingForKeys = await VotingForKeys.new();
    votingForKeysEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingForKeys.address);
    votingForKeys = await VotingForKeys.at(votingForKeysEternalStorage.address);
    await votingForKeys.init(172800).should.be.fulfilled;

    let votingForMinThreshold = await VotingForMinThreshold.new();
    const votingForMinThresholdEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingForMinThreshold.address);
    votingForMinThreshold = await VotingForMinThreshold.at(votingForMinThresholdEternalStorage.address);
    await votingForMinThreshold.init(172800, 3).should.be.fulfilled;

    let votingForEmissionFunds = await VotingForEmissionFunds.new();
    const votingForEmissionFundsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingForEmissionFunds.address);
    votingForEmissionFunds = await VotingForEmissionFunds.at(votingForEmissionFundsEternalStorage.address);
    
    voting = await VotingToChangeProxyAddress.new();
    votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    voting = await VotingToChangeProxyAddress.at(votingEternalStorage.address);
    await voting.init(172800, {from: accounts[8]}).should.be.rejectedWith(ERROR_MSG);
    await voting.init(172800).should.be.fulfilled;

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, validatorMetadata.address);

    let rewardByBlock = await RewardByBlock.new();
    const rewardByBlockEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, rewardByBlock.address);
    rewardByBlock = await RewardByBlock.at(rewardByBlockEternalStorage.address);

    await proxyStorageMock.initializeAddresses(
      keysManagerEternalStorage.address,
      votingForKeysEternalStorage.address,
      votingForMinThresholdEternalStorage.address,
      votingEternalStorage.address,
      votingForEmissionFunds.address,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address,
      rewardByBlock.address
    );
  })

  describe('#createBallot', async () => {
    let id;
    beforeEach(async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await addMiningKey(accounts[1]);
      await addVotingKey(votingKey, accounts[1]);
      await proxyStorageMock.setVotingContractMock(votingForKeysEternalStorage.address);
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      id = await voting.nextBallotId.call();
    })
    it('happy path', async () => {
      // uint256 _startTime,
      // uint256 _endTime,
      // address _proposedValue,
      // uint8 _contractType
      const {logs} = await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo", { from: votingKey }
      );
      const keysManagerFromContract = await voting.getKeysManager.call();
      const ballotInfo = await voting.getBallotInfo.call(id, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        accounts[5], // proposedValue
        new web3.BigNumber(1), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);
      
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(id)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);
      
      let activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(1);

      let nextBallotId = await voting.nextBallotId.call();
      nextBallotId.should.be.bignumber.equal(1);

      keysManagerFromContract.should.be.equal(keysManager.address);
      logs[0].event.should.be.equal("BallotCreated");
      logs[0].args.id.should.be.bignumber.equal(0);
      logs[0].args.creator.should.be.equal(votingKey);
    })
    it('proposed address should not be 0x0', async () => {
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, '0x0000000000000000000000000000000000000000', 2, "memo",{ from: votingKey }).should.be.fulfilled.rejectedWith(ERROR_MSG);
    })
    it('can create multiple ballots', async () => {
      const { logs } = await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo",{ from: votingKey });
      const keysManagerFromContract = await voting.getKeysManager.call();

      let activeBallotsLength = await voting.activeBallotsLength.call();
      activeBallotsLength.should.be.bignumber.equal(1);

      let nextBallotId = await voting.nextBallotId.call();
      nextBallotId.should.be.bignumber.equal(1);

      await voting.createBallot(
        VOTING_START_DATE + 1, VOTING_END_DATE + 1, accounts[5], 2, "memo",{ from: votingKey }
      );

      const ballotInfo = await voting.getBallotInfo.call(nextBallotId, votingKey);

      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE+1), // startTime
        new web3.BigNumber(VOTING_END_DATE+1), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        accounts[5], // proposedValue
        new web3.BigNumber(2), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);

      (await voting.getQuorumState.call(nextBallotId)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(nextBallotId)).should.be.bignumber.equal(1);
      (await voting.getMinThresholdOfVoters.call(nextBallotId)).should.be.bignumber.equal(1);
    })
    it('should not let create more ballots than the limit', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 2, "memo",{from: votingKey});
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 2, "memo",{from: votingKey});
      // we have 1 validator, so 200 limit / 1 = 200
      new web3.BigNumber(200).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await addValidators({proxyStorageMock, keysManager, poaNetworkConsensusMock}); // add 100 validators, so total will be 101 validator
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getBallotLimitPerValidator.call());
      await voting.createBallot(VOTING_START_DATE, VOTING_END_DATE, accounts[5], 2, "memo",{from: votingKey}).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#vote', async () => {
    let id;
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await addMiningKey(accounts[1]);
      await addVotingKey(votingKey, accounts[1]);
      id = await voting.nextBallotId.call();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo", { from: votingKey }
      );
    })

    it('should let a validator to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      const { logs } = await voting.vote(id, choice.accept, { from: votingKey }).should.be.fulfilled;
      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
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
      const { logs } = await voting.vote(id, choice.reject, { from: votingKey }).should.be.fulfilled;
      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
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
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.fulfilled;
      await addVotingKey(accounts[3], accounts[1]);
      await voting.vote(id, choice.reject, { from: accounts[3] }).should.be.rejectedWith(ERROR_MSG);

      // add new voter
      await addMiningKey(accounts[2]);
      await addVotingKey(accounts[4], accounts[2]);
      await voting.vote(id, choice.reject, { from: accounts[4] }).should.be.fulfilled;

      let progress = (await voting.getBallotInfo.call(id, votingKey))[3];
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(2);

      await addMiningKey(accounts[3]);
      await addVotingKey(accounts[5], accounts[3]);
      await voting.vote(id, choice.accept, { from: accounts[5] }).should.be.fulfilled;

      progress = (await voting.getBallotInfo.call(id, votingKey))[3];
      progress.should.be.bignumber.equal(-1);

      totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(3);
    })
    it('should not let vote nonVoting key', async () => {
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(id, choice.reject, { from: accounts[0] }).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote before startTime key', async () => {
      await voting.setTime(VOTING_START_DATE - 1);
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote after endTime key', async () => {
      await voting.setTime(VOTING_END_DATE + 1);
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with already voted key', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.fulfilled;
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with invalid choice', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(id, 0, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(id, 3, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not let vote with invalid id', async () => {
      await voting.setTime(VOTING_END_DATE);
      await voting.vote(99, 1, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      await voting.vote(-3, 1, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#finalize', async () => {
    let votingId;
    let payoutKeyToAdd;
    beforeEach(async () => {
      votingKey = accounts[2];
      votingKey2 = accounts[3];
      votingKey3 = accounts[5];
      payoutKeyToAdd = accounts[0];

      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await addMiningKey(accounts[1]);
      await addVotingKey(votingKey, accounts[1]);

      await addMiningKey(accounts[6]);
      await addVotingKey(votingKey2, accounts[6]);

      await addMiningKey(accounts[4]);
      await addVotingKey(votingKey3, accounts[4]);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(votingForKeysEternalStorage.address);
    })

    it('does not change if it did not pass minimum threshold', async () => {
      let proposedValue = 5;
      let contractType = 1; //keysManager
      votingId = await voting.nextBallotId.call();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], contractType, "memo", { from: votingKey }
      );
      await voting.finalize(votingId, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.fulfilled;
      // await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      const { logs } = await voting.finalize(votingId, { from: votingKey });
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
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
        accounts[5], // proposedValue
        new web3.BigNumber(contractType), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);

      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);

      const minThresholdOfVoters = await ballotsStorage.getBallotThreshold.call(1);
      minThresholdOfVoters.should.be.bignumber.equal(3);
    });

    it('should change KeysManager implementation', async () => {
      let contractType = 1;
      let keysManagerNew = await KeysManagerMock.new();
      let newAddress = keysManagerNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getKeysManager.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change VotingToChangeKeys implementation', async () => {
      let contractType = 2;
      let votingToChangeKeysNew = await VotingForKeys.new();
      let newAddress = votingToChangeKeysNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getVotingToChangeKeys.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change VotingToChangeMinThreshold implementation', async () => {
      let contractType = 3;
      let votingToChangeMinThresholdNew = await VotingForMinThreshold.new();
      let newAddress = votingToChangeMinThresholdNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getVotingToChangeMinThreshold.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change VotingToChangeProxy implementation', async () => {
      let contractType = 4;
      let votingToChangeProxyNew = await VotingToChangeProxyAddress.new();
      let newAddress = votingToChangeProxyNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getVotingToChangeProxy.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change BallotsStorage implementation', async () => {
      let contractType = 5;
      let ballotsStorageNew = await BallotsStorage.new();
      let newAddress = ballotsStorageNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getBallotsStorage.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change ValidatorMetadata implementation', async () => {
      let contractType = 7;
      let validatorMetadataNew = await ValidatorMetadata.new();
      let newAddress = validatorMetadataNew.address;
      await deployAndTest({contractType, newAddress})
      let eternalProxyAddress = await proxyStorageMock.getValidatorMetadata.call();
      let eternalProxy = await EternalStorageProxy.at(eternalProxyAddress);
      newAddress.should.be.equal(await eternalProxy.implementation.call());
    })
    it('should change ProxyStorage implementation', async () => {
      const contractType = 8;
      const proxyStorageNew = await ProxyStorageMock.new();
      const newAddress = proxyStorageNew.address;
      await deployAndTest({contractType, newAddress})
      newAddress.should.be.equal(await proxyStorageMock.implementation.call());
    })
    it('prevents double finalize', async () => {
      let newAddress1 = accounts[4];
      let newAddress2 = accounts[5];
      let contractType1 = 100;
      let contractType2 = 101;
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, newAddress1, contractType1, "memo", { from: votingKey }
      );
      await voting.createBallot(
        VOTING_START_DATE+2, VOTING_END_DATE+2, newAddress2, contractType2, "memo", { from: votingKey }
      );

      const activeBallotsLength = await voting.activeBallotsLength.call();
      votingId = await voting.activeBallots.call(activeBallotsLength.toNumber() - 2);
      let votingIdForSecond = votingId.add(1);
      await voting.setTime(VOTING_START_DATE);
      await voting.vote(votingId, choice.reject, {from: votingKey}).should.be.fulfilled;
      false.should.be.equal(await voting.hasAlreadyVoted.call(votingId, votingKey2));
      await voting.vote(votingId, choice.reject, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      false.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      await finalize(votingId, true, {from: votingKey});
      true.should.be.equal((await voting.getBallotInfo.call(votingId, votingKey))[4]); // isFinalized
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal(await voting.getIsFinalized.call(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await finalize(votingIdForSecond, true, {from: votingKey});

      new web3.BigNumber(-1).should.be.bignumber.equal((await voting.getBallotInfo.call(votingIdForSecond, votingKey))[3]) // progress

      let ballotInfo = await voting.getBallotInfo.call(votingId, votingKey);
      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(3), // totalVoters
        new web3.BigNumber(-1), // progress
        true, // isFinalized
        newAddress1, // proposedValue
        new web3.BigNumber(contractType1), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);

      ballotInfo = await voting.getBallotInfo.call(votingIdForSecond, votingKey);
      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE+2), // startTime
        new web3.BigNumber(VOTING_END_DATE+2), // endTime
        new web3.BigNumber(1), // totalVoters
        new web3.BigNumber(-1), // progress
        true, // isFinalized
        newAddress2, // proposedValue
        new web3.BigNumber(contractType2), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        true // hasAlreadyVoted
      ]);
      (await voting.getQuorumState.call(votingIdForSecond)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingIdForSecond)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingIdForSecond)).should.be.bignumber.equal(2);
    });

    it('allowed at once after all validators gave their votes', async () => {
      await voting.createBallot(
        VOTING_START_DATE, // uint256 _startTime
        VOTING_END_DATE,   // uint256 _endTime
        accounts[7],       // address _proposedValue
        100,               // uint8 _contractType
        "memo",            // string _memo
        {from: votingKey}
      ).should.be.fulfilled;

      false.should.be.equal((await voting.getBallotInfo.call(0, votingKey))[4]); // isFinalized

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
        accounts[8],       // address _proposedValue
        100,               // uint8 _contractType
        "memo",            // string _memo
        {from: votingKey}
      ).should.be.fulfilled;

      false.should.be.equal((await voting.getBallotInfo.call(1, votingKey))[4]); // isFinalized

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
  });

  describe('#migrate', async () => {
    it('should copy a ballot to the new contract', async () => {
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await addMiningKey(accounts[1]);
      await addVotingKey(votingKey, accounts[1]);
      await proxyStorageMock.setVotingContractMock(votingForKeysEternalStorage.address);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;

      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();

      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo", {from: votingKey}
      ).should.be.fulfilled;

      let votingNew = await VotingToChangeProxyAddress.new();
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, votingNew.address);
      votingNew = await VotingToChangeProxyAddress.at(votingEternalStorage.address);

      let ballotInfo = await voting.getBallotInfo.call(id, votingKey);

      await votingNew.migrateBasicOne(
        id,
        voting.address,
        await voting.getQuorumState.call(id),
        await voting.getIndex.call(id),
        ballotInfo[7],
        ballotInfo[8],
        [accounts[3], accounts[4], accounts[5]]
      );

      ballotInfo = await votingNew.getBallotInfo.call(id, votingKey);
      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        accounts[5], // proposedValue
        new web3.BigNumber(1), // contractType
        accounts[1], // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);
      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);

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
    let proxyStorageStubAddress;
    beforeEach(async () => {
      proxyStorageStubAddress = accounts[8];
      voting = await VotingToChangeProxyAddress.new();
      votingEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, voting.address);
      voting = await VotingToChangeProxyAddress.at(votingEternalStorage.address);
      await voting.init(172800).should.be.fulfilled;
    });
    it('may only be called by ProxyStorage', async () => {
      let votingNew = await VotingToChangeProxyAddressNew.new();
      await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
    });
    it('should change implementation address', async () => {
      let votingNew = await VotingToChangeProxyAddressNew.new();
      let oldImplementation = await voting.implementation.call();
      let newImplementation = votingNew.address;
      (await votingEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);
      (await votingNew.implementation.call()).should.be.equal(newImplementation);
      (await votingEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let votingNew = await VotingToChangeProxyAddressNew.new();
      let oldVersion = await voting.version.call();
      let newVersion = oldVersion.add(1);
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);
      (await votingNew.version.call()).should.be.bignumber.equal(newVersion);
      (await votingEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let votingNew = await VotingToChangeProxyAddressNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);
      (await votingNew.initialized.call()).should.be.equal(false);
      await votingNew.initialize();
      (await votingNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let votingNew = await VotingToChangeProxyAddressNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);
      (await votingNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      const id = await voting.nextBallotId.call();
      proxyStorageMock.setVotingContractMock(accounts[0]);
      await addMiningKey(miningKeyForVotingKey);
      await addVotingKey(votingKey, miningKeyForVotingKey);
      proxyStorageMock.setVotingContractMock(votingForKeysEternalStorage.address);
      await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo", { from: votingKey }
      ).should.be.fulfilled;
      await votingEternalStorage.setProxyStorage(proxyStorageStubAddress);
      let votingNew = await VotingToChangeProxyAddressNew.new();
      await upgradeTo(votingNew.address, {from: proxyStorageStubAddress});
      votingNew = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);
      await votingEternalStorage.setProxyStorage(proxyStorageMock.address);

      const ballotInfo = await votingNew.getBallotInfo.call(id, votingKey);
      ballotInfo.should.be.deep.equal([
        new web3.BigNumber(VOTING_START_DATE), // startTime
        new web3.BigNumber(VOTING_END_DATE), // endTime
        new web3.BigNumber(0), // totalVoters
        new web3.BigNumber(0), // progress
        false, // isFinalized
        accounts[5], // proposedValue
        new web3.BigNumber(1), // contractType
        miningKeyForVotingKey, // creator
        "memo", // memo
        false, // canBeFinalizedNow
        false // hasAlreadyVoted
      ]);
      (await votingNew.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await votingNew.getIndex.call(id)).should.be.bignumber.equal(0);
      (await votingNew.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);
    });
  });
})

async function deployAndTest({
  contractType,
  newAddress
}) {
  votingId = await voting.nextBallotId.call();
  await voting.createBallot(
    VOTING_START_DATE, VOTING_END_DATE, newAddress, contractType, "memo", { from: votingKey }
  );
  await voting.setTime(VOTING_START_DATE);
  await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.fulfilled;
  await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
  await voting.vote(votingId, choice.accept, { from: votingKey2 }).should.be.fulfilled;
  await voting.vote(votingId, choice.reject, { from: votingKey3 }).should.be.fulfilled;
  await voting.setTime(VOTING_END_DATE + 1);
  const { logs } = await voting.finalize(votingId, { from: votingKey });

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
    newAddress, // proposedValue
    new web3.BigNumber(contractType), // contractType
    miningKeyForVotingKey, // creator
    "memo", // memo
    false, // canBeFinalizedNow
    true // hasAlreadyVoted
  ]);
  (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
  (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
  (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);

  if (contractType !== 1) {
    true.should.be.equal(
      await voting.hasAlreadyVoted.call(votingId, votingKey)
    );
    true.should.be.equal(
      await voting.hasAlreadyVoted.call(votingId, votingKey2)
    );
    true.should.be.equal(
      await voting.hasAlreadyVoted.call(votingId, votingKey3)
    );
  }
}

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
