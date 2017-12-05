let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./KeysManagerMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');

const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('KeysManager [all features]', function (accounts) {
  let keysManager, poaNetworkConsensusMock, proxyStorageMock;
  masterOfCeremony = accounts[0];

  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony);
    proxyStorageMock = await ProxyStorageMock.new(poaNetworkConsensusMock.address, masterOfCeremony);
    keysManager = await KeysManagerMock.new(proxyStorageMock.address, poaNetworkConsensusMock.address, masterOfCeremony);
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);
    await proxyStorageMock.initializeAddresses(keysManager.address, masterOfCeremony, masterOfCeremony, masterOfCeremony, masterOfCeremony);
  });

  describe('#constructor', async () => {
    it('sets masterOfCeremony, proxyStorage, poaConsensus', async () => {
      masterOfCeremony.should.be.equal(await keysManager.masterOfCeremony());
      proxyStorageMock.address.should.be.equal(await keysManager.proxyStorage());
      poaNetworkConsensusMock.address.should.be.equal(await keysManager.poaNetworkConsensus());
    })
    it('adds masterOfCeremony to validators hash', async () => {
      const validator = await keysManager.validatorKeys(masterOfCeremony);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false]
      )
    })
  });

  describe('#initiateKeys', async () => {
    it('can only be called by master of ceremony', async() => {
      await keysManager.initiateKeys(accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.fulfilled;
    })

    it('cannot allow 0x0 addresses', async () => {
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys('0x0').should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow to initialize already initialized key', async () => {
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.fulfilled;   
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not equal to master of ceremony', async () => {
      await keysManager.initiateKeys(masterOfCeremony, {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow to initialize more than maxNumberOfInitialKeys', async () => {
      await keysManager.setMaxNumberOfInitialKeys(2);
      let maxNumberOfInitialKeys = await keysManager.maxNumberOfInitialKeys();
      maxNumberOfInitialKeys.should.be.bignumber.equal(2);
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[3], {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should increment initialKeyCount by 1', async () => {
      let initialKeysCount = await keysManager.initialKeysCount();
      initialKeysCount.should.be.bignumber.equal(0);
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      initialKeysCount = await keysManager.initialKeysCount();
      initialKeysCount.should.be.bignumber.equal(1);
    })

    it('should set initialKeys hash to true', async() => {
      false.should.be.equal(await keysManager.initialKeys(accounts[1]));
      const {logs} = await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      true.should.be.equal(await keysManager.initialKeys(accounts[1]));
      let initialKeysCount = await keysManager.initialKeysCount();
      // event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);
      logs[0].event.should.equal("InitialKeyCreated");
      logs[0].args.initialKey.should.be.equal(accounts[1]);
      initialKeysCount.should.be.bignumber.equal(logs[0].args.initialKeysCount);
    })
  });
  describe('#createKeys', async () => {
    it('should only be called from initialized key', async () => {
      await keysManager.createKeys(accounts[2], accounts[3], accounts[4], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[2], accounts[3], accounts[4], {from: accounts[1]}).should.be.fulfilled;
    });
    it('params should not be equal to each other', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(masterOfCeremony, masterOfCeremony, accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(masterOfCeremony, accounts[2], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(masterOfCeremony, accounts[2], masterOfCeremony, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    });
    it('any of params should not be equal to initialKey', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[1], masterOfCeremony, accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(masterOfCeremony, accounts[1], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(masterOfCeremony, accounts[2], accounts[1], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should assign mining, voting, payout keys to relative mappings', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      const {logs} = await keysManager.createKeys(accounts[4], accounts[3], accounts[2], {from: accounts[1]}).should.be.fulfilled;
      true.should.be.equal(
        await keysManager.isMiningActive(accounts[4])
      )
      true.should.be.equal(
        await keysManager.isVotingActive(accounts[3])
      )
      true.should.be.equal(
        await keysManager.isPayoutActive(accounts[4])
      )
      // event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
      logs[0].event.should.be.equal('ValidatorInitialized');
      logs[0].args.miningKey.should.be.equal(accounts[4]);
      logs[0].args.votingKey.should.be.equal(accounts[3]);
      logs[0].args.payoutKey.should.be.equal(accounts[2]);
    });

    it('should assigns voting <-> mining key relationship', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[4], accounts[3], accounts[2], {from: accounts[1]});
      const miningKey = await keysManager.getMiningKeyByVoting(accounts[3]);
      miningKey.should.be.equal(accounts[4]);
    });
    it('adds validator to poaConsensus contract', async () => {
      let miningKey = accounts[4];
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(miningKey, accounts[3], accounts[2], {from: accounts[1]});
      const index = await poaNetworkConsensusMock.currentValidatorsLength();
      (await poaNetworkConsensusMock.pendingList(index)).should.be.equal(miningKey);
    })
  })

  describe('#addMiningKey', async () => {
    it('should only be called from votingToChangeKeys', async () => {
      await keysManager.addMiningKey(accounts[1],{from: accounts[5]}).should.be.rejectedWith(ERROR_MSG);
      await proxyStorageMock.setVotingContractMock(accounts[2]);
      await keysManager.addMiningKey(accounts[1], {from: accounts[2]}).should.be.fulfilled;
    })
    it('should not let add more than maxLimit', async () => {
      await poaNetworkConsensusMock.setCurrentValidatorsLength(2001);
      await keysManager.addMiningKey(accounts[2]).should.be.rejectedWith(ERROR_MSG);
    })
    it('should set validatorKeys hash', async () => {
      const {logs} = await keysManager.addMiningKey(accounts[2]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[2]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false]
      )
      logs[0].event.should.be.equal('MiningKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.action.should.be.equal('added');
    })
  })

  describe('#addVotingKey', async () => {
    it('should add VotingKey', async () => {
      await keysManager.addVotingKey(accounts[2],accounts[1], {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
      true.should.be.equal(await keysManager.isVotingActive(accounts[2]));
      logs[0].event.should.be.equal('VotingKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.miningKey.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('added');

      const miningKey = await keysManager.getMiningKeyByVoting(accounts[2]);
      miningKey.should.be.equal(accounts[1]);
    })
    it('should only be called if mining is active', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.rejectedWith(ERROR_MSG);
    })

    it('swaps keys if voting already exists', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      false.should.be.equal(await keysManager.isVotingActive(accounts[2]));
      true.should.be.equal(await keysManager.isVotingActive(accounts[3]));
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ accounts[3],
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false]
      )
    })
  })

  describe('#addPayoutKey', async () => {
    it('should add PayoutKey', async () => {
      await keysManager.addPayoutKey(accounts[2],accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      logs[0].event.should.be.equal('PayoutKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.miningKey.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('added');
    })
    it('should only be called if mining is active', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.rejectedWith(ERROR_MSG);
    })

    it('swaps keys if voting already exists', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[3], accounts[1]).should.be.fulfilled;
      true.should.be.equal(await keysManager.isPayoutActive(accounts[1]));
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        accounts[3],
        true,
        false,
        true]
      )
    })
  })

  describe('#removeMiningKey', async () => {
    it('should remove miningKey', async () => {
      await keysManager.removeMiningKey(accounts[1], {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      logs[0].event.should.be.equal('MiningKeyChanged');
      logs[0].args.key.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('removed');
      const miningKey = await keysManager.getMiningKeyByVoting(validator[0]);
      miningKey.should.be.equal('0x0000000000000000000000000000000000000000');
    })
    it('removes validator from poaConsensus', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensusMock.currentValidatorsLength();
      let pendingList = [];
      for(let i = 0; i < currentValidatorsLength.sub(1).toNumber(); i++){
          let pending = await poaNetworkConsensusMock.pendingList(i);
          pendingList.push(pending);
      }
      pendingList.should.not.contain(accounts[1]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators();
      validators.should.not.contain(accounts[1]);
      const expected = currentValidatorsLength.sub(1);
      const actual = await poaNetworkConsensusMock.currentValidatorsLength();
      expected.should.be.bignumber.equal(actual);
    })

    it('should still enforce removal of votingKey to 0x0 even if voting key didnot exist', async () => {
      await keysManager.removeMiningKey(accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      const miningKey = await keysManager.getMiningKeyByVoting(validator[0]);
      miningKey.should.be.equal('0x0000000000000000000000000000000000000000');
    })
  })

  describe('#removeVotingKey', async () => {
    it('should remove votingKey', async () => {
      const {mining, voting, payout} = {mining: accounts[1], voting: accounts[3], payout: accounts[2]};
      await keysManager.removeVotingKey(mining, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(mining).should.be.fulfilled;
      await keysManager.addVotingKey(voting, mining).should.be.fulfilled;
      await keysManager.addPayoutKey(payout, mining).should.be.fulfilled;
      const {logs} = await keysManager.removeVotingKey(mining).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(mining);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        payout,
        true,
        false,
        true]
      )
      logs[0].event.should.be.equal('VotingKeyChanged');
      logs[0].args.key.should.be.equal(voting);
      logs[0].args.action.should.be.equal('removed');
      const miningKey = await keysManager.getMiningKeyByVoting(accounts[1]);
      miningKey.should.be.equal('0x0000000000000000000000000000000000000000');
    })
  })

  describe('#removePayoutKey', async () => {
    it('should remove payoutKey', async () => {
      await keysManager.removePayoutKey(accounts[1], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removePayoutKey(accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ accounts[3],
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false]
      )
      logs[0].event.should.be.equal('PayoutKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.action.should.be.equal('removed');
    })
  })

  describe('#swapMiningKey', async () => {
    it ('should swap mining key', async () => {
      await keysManager.swapMiningKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.swapMiningKey(accounts[2], accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      const validatorNew = await keysManager.validatorKeys(accounts[2]);
      validatorNew.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false]
      )
    })
  })

  describe('#swapVotingKey', async () => {
    it ('should swap voting key', async () => {
      await keysManager.swapVotingKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.swapVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ accounts[3],
        '0x0000000000000000000000000000000000000000',
        true,
        true,
        false]
      )
    })
  })

  describe('#swapPayoutKey', async () => {
    it ('should swap payout key', async () => {
      await keysManager.swapPayoutKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.swapPayoutKey(accounts[3], accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        accounts[3],
        true,
        false,
        true]
      )
    })
  })
});