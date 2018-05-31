let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let VotingToChangeProxyAddress = artifacts.require('./mockContracts/VotingToChangeProxyAddressMock');
let VotingToChangeProxyAddressNew = artifacts.require('./upgradeContracts/VotingToChangeProxyAddressNew');
let VotingForKeys = artifacts.require('./mockContracts/VotingToChangeKeysMock');
let VotingForMinThreshold = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
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

let keysManager, poaNetworkConsensusMock, ballotsStorage, voting;
let votingKey, votingKey2, votingKey3, miningKeyForVotingKey;
let votingForKeysEternalStorage;
let VOTING_START_DATE, VOTING_END_DATE;
contract('VotingToChangeProxyAddress upgraded [all features]', function (accounts) {
  votingKey = accounts[2];
  masterOfCeremony = accounts[0];
  miningKeyForVotingKey = accounts[1];
  
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
    
    voting = await VotingToChangeProxyAddress.new();
    const votingEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, voting.address);
    voting = await VotingToChangeProxyAddress.at(votingEternalStorage.address);
    await voting.init(172800, {from: accounts[8]}).should.be.rejectedWith(ERROR_MSG);
    await voting.init(172800).should.be.fulfilled;

    votingNew = await VotingToChangeProxyAddressNew.new();
    await votingEternalStorage.setProxyStorage(accounts[7]);
    await votingEternalStorage.upgradeTo(votingNew.address, {from: accounts[7]}).should.be.fulfilled;
    await votingEternalStorage.setProxyStorage(proxyStorageMock.address);
    voting = await VotingToChangeProxyAddressNew.at(votingEternalStorage.address);

    const validatorMetadata = await ValidatorMetadata.new();
    const validatorMetadataEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, validatorMetadata.address);

    await proxyStorageMock.initializeAddresses(
      keysManagerEternalStorage.address,
      votingForKeysEternalStorage.address,
      votingForMinThresholdEternalStorage.address,
      votingEternalStorage.address,
      ballotsEternalStorage.address,
      validatorMetadataEternalStorage.address
    );
  })

  describe('#createBallot', async () => {
    let id;
    beforeEach(async () => {
      proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      proxyStorageMock.setVotingContractMock(votingForKeysEternalStorage.address);
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
      (await voting.getStartTime.call(id)).should.be.bignumber.equal(VOTING_START_DATE);
      (await voting.getEndTime.call(id)).should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getTotalVoters.call(id)).should.be.bignumber.equal(0);
      (await voting.getProgress.call(id)).should.be.bignumber.equal(0);
      (await voting.getIsFinalized.call(id)).should.be.equal(false);
      (await voting.getQuorumState.call(id)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(id)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(id)).should.be.bignumber.equal(1);
      (await voting.getProposedValue.call(id)).should.be.equal(accounts[5]);
      (await voting.getContractType.call(id)).should.be.bignumber.equal(1);
      (await voting.getCreator.call(id)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(id)).should.be.equal("memo");
      
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
      (await voting.getStartTime.call(nextBallotId)).should.be.bignumber.equal(VOTING_START_DATE+1);
      (await voting.getEndTime.call(nextBallotId)).should.be.bignumber.equal(VOTING_END_DATE+1);
      (await voting.getTotalVoters.call(nextBallotId)).should.be.bignumber.equal(0);
      (await voting.getProgress.call(nextBallotId)).should.be.bignumber.equal(0);
      (await voting.getIsFinalized.call(nextBallotId)).should.be.equal(false);
      (await voting.getQuorumState.call(nextBallotId)).should.be.bignumber.equal(1);
      (await voting.getIndex.call(nextBallotId)).should.be.bignumber.equal(1);
      (await voting.getMinThresholdOfVoters.call(nextBallotId)).should.be.bignumber.equal(1);
      (await voting.getProposedValue.call(nextBallotId)).should.be.equal(accounts[5]);
      (await voting.getContractType.call(nextBallotId)).should.be.bignumber.equal(2);
      (await voting.getCreator.call(nextBallotId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(nextBallotId)).should.be.equal("memo");
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
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;
      id = await voting.nextBallotId.call();
      await voting.createBallot(
        VOTING_START_DATE, VOTING_END_DATE, accounts[5], 1, "memo", { from: votingKey }
      );
    })

    it('should let a validator to vote', async () => {
      await voting.setTime(VOTING_START_DATE);
      const { logs } = await voting.vote(id, choice.accept, { from: votingKey }).should.be.fulfilled;
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
      const { logs } = await voting.vote(id, choice.reject, { from: votingKey }).should.be.fulfilled;
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
      await voting.vote(id, choice.reject, { from: votingKey }).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await voting.vote(id, choice.reject, { from: accounts[3] }).should.be.rejectedWith(ERROR_MSG);

      // add new voter
      await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[4], accounts[2]).should.be.fulfilled;
      await voting.vote(id, choice.reject, { from: accounts[4] }).should.be.fulfilled;

      let progress = await voting.getProgress.call(id);
      progress.should.be.bignumber.equal(-2);

      let totalVoters = await voting.getTotalVoters.call(id);
      totalVoters.should.be.bignumber.equal(2);

      await keysManager.addMiningKey(accounts[3]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[5], accounts[3]).should.be.fulfilled;
      await voting.vote(id, choice.accept, { from: accounts[5] }).should.be.fulfilled;

      progress = await voting.getProgress.call(id);
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
    votingKey = accounts[2];
    votingKey2 = accounts[3];
    votingKey3 = accounts[5];
    let payoutKeyToAdd = accounts[0];
    beforeEach(async () => {
      VOTING_START_DATE = moment.utc().add(20, 'seconds').unix();
      VOTING_END_DATE = moment.utc().add(10, 'days').unix();
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey, accounts[1]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[6]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey2, accounts[6]).should.be.fulfilled;

      await keysManager.addMiningKey(accounts[4]).should.be.fulfilled;
      await keysManager.addVotingKey(votingKey3, accounts[4]).should.be.fulfilled;
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
      const { logs } = await voting.finalize(votingId, { from: votingKey }).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, { from: votingKey }).should.be.rejectedWith(ERROR_MSG);
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
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);
      (await voting.getProposedValue.call(votingId)).should.be.equal(accounts[5]);
      (await voting.getContractType.call(votingId)).should.be.bignumber.equal(contractType);
      (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingId)).should.be.equal("memo");
      true.should.be.equal(
        await voting.hasAlreadyVoted.call(votingId, votingKey)
      );
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
      await voting.vote(votingId, choice.accept, {from: votingKey2}).should.be.fulfilled;
      await voting.vote(votingId, choice.accept, {from: votingKey3}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 1);
      false.should.be.equal(await voting.getIsFinalized.call(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.fulfilled;
      true.should.be.equal(await voting.getIsFinalized.call(votingId));
      await voting.finalize(votingId, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal(await voting.getIsFinalized.call(votingIdForSecond));
      await voting.vote(votingIdForSecond, choice.reject, {from: votingKey}).should.be.fulfilled;
      await voting.setTime(VOTING_END_DATE + 3);
      await voting.finalize(votingIdForSecond, {from: votingKey}).should.be.fulfilled;

      new web3.BigNumber(-1).should.be.bignumber.equal(await voting.getProgress.call(votingIdForSecond))
      new web3.BigNumber(1).should.be.bignumber.equal(await voting.getProgress.call(votingId))

      let startTime = await voting.getStartTime.call(votingId);
      let endTime = await voting.getEndTime.call(votingId);
      startTime.should.be.bignumber.equal(VOTING_START_DATE);
      endTime.should.be.bignumber.equal(VOTING_END_DATE);
      (await voting.getTotalVoters.call(votingId)).should.be.bignumber.equal(3);
      (await voting.getProgress.call(votingId)).should.be.bignumber.equal(1);
      (await voting.getIsFinalized.call(votingId)).should.be.equal(true);
      (await voting.getQuorumState.call(votingId)).should.be.bignumber.equal(2);
      (await voting.getIndex.call(votingId)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);
      (await voting.getProposedValue.call(votingId)).should.be.equal(newAddress1);
      (await voting.getContractType.call(votingId)).should.be.bignumber.equal(contractType1);
      (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingId)).should.be.equal("memo");

      startTime = await voting.getStartTime.call(votingIdForSecond);
      endTime = await voting.getEndTime.call(votingIdForSecond);
      startTime.should.be.bignumber.equal(VOTING_START_DATE+2);
      endTime.should.be.bignumber.equal(VOTING_END_DATE+2);
      (await voting.getTotalVoters.call(votingIdForSecond)).should.be.bignumber.equal(1);
      (await voting.getProgress.call(votingIdForSecond)).should.be.bignumber.equal(-1);
      (await voting.getIsFinalized.call(votingIdForSecond)).should.be.equal(true);
      (await voting.getQuorumState.call(votingIdForSecond)).should.be.bignumber.equal(3);
      (await voting.getIndex.call(votingIdForSecond)).should.be.bignumber.equal(0);
      (await voting.getMinThresholdOfVoters.call(votingIdForSecond)).should.be.bignumber.equal(2);
      (await voting.getProposedValue.call(votingIdForSecond)).should.be.equal(newAddress2);
      (await voting.getContractType.call(votingIdForSecond)).should.be.bignumber.equal(contractType2);
      (await voting.getCreator.call(votingIdForSecond)).should.be.equal(miningKeyForVotingKey);
      (await voting.getMemo.call(votingIdForSecond)).should.be.equal("memo");
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
        accounts[8],       // address _proposedValue
        100,               // uint8 _contractType
        "memo",            // string _memo
        {from: votingKey}
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
  const { logs } = await voting.finalize(votingId, { from: votingKey }).should.be.fulfilled;

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
  (await voting.getMinThresholdOfVoters.call(votingId)).should.be.bignumber.equal(2);
  (await voting.getProposedValue.call(votingId)).should.be.equal(newAddress);
  (await voting.getContractType.call(votingId)).should.be.bignumber.equal(contractType);
  (await voting.getCreator.call(votingId)).should.be.equal(miningKeyForVotingKey);
  (await voting.getMemo.call(votingId)).should.be.equal("memo");
  
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
