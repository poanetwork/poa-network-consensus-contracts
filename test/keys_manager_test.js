let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let KeysManagerNew = artifacts.require('./upgradeContracts/KeysManagerNew');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let EternalStorageProxy = artifacts.require('./EternalStorageProxyMock');

const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('KeysManager [all features]', function (accounts) {
  let keysManager, poaNetworkConsensusMock, proxyStorageMock;
  masterOfCeremony = accounts[0];

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
      "0x0000000000000000000000000000000000000000",
      {from: accounts[1]}
    ).should.be.rejectedWith(ERROR_MSG);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);

    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0]
    );
  });

  describe('#constructor', async () => {
    it('sets masterOfCeremony, proxyStorage, poaConsensus', async () => {
      masterOfCeremony.should.be.equal(await keysManager.masterOfCeremony.call());
      proxyStorageMock.address.should.be.equal(await keysManager.proxyStorage.call());
      poaNetworkConsensusMock.address.should.be.equal(await keysManager.poaNetworkConsensus.call());
    })
    it('adds masterOfCeremony to validators hash', async () => {
      const validator = await keysManager.validatorKeys.call(masterOfCeremony);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false]
      )
    });
    it('cannot be called twice', async () => {
      await keysManager.init(
        '0x0000000000000000000000000000000000000000'
      ).should.be.rejectedWith(ERROR_MSG);
    });
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

    it('should not allow to initialize already initialized key after validator created mining key', async () => {
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.fulfilled;   
      await keysManager.createKeys(accounts[3],accounts[4],accounts[5], {from: accounts[2]}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[2], {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not equal to master of ceremony', async () => {
      await keysManager.initiateKeys(masterOfCeremony, {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow to initialize more than maxNumberOfInitialKeys', async () => {
      let maxNumberOfInitialKeys = await keysManager.maxNumberOfInitialKeys.call();
      maxNumberOfInitialKeys.should.be.bignumber.equal(12);
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000001', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000002', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000003', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000004', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000005', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000006', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000007', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000008', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000009', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000010', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000011', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000012', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000013', {from: masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should increment initialKeyCount by 1', async () => {
      let initialKeysCount = await keysManager.initialKeysCount.call();
      initialKeysCount.should.be.bignumber.equal(0);
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      initialKeysCount = await keysManager.initialKeysCount.call();
      initialKeysCount.should.be.bignumber.equal(1);
    })

    it('should set initialKeys hash to activated status', async() => {
      new web3.BigNumber(0).should.be.bignumber.equal(await keysManager.getInitialKeyStatus.call(accounts[1]));
      const {logs} = await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      new web3.BigNumber(1).should.be.bignumber.equal(await keysManager.getInitialKeyStatus.call(accounts[1]));
      let initialKeysCount = await keysManager.initialKeysCount.call();
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
    it('params should not be equal to 0x0', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(
        '0x0000000000000000000000000000000000000000',
        accounts[3],
        accounts[4],
        {from: accounts[1]}
      ).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(
        accounts[2],
        '0x0000000000000000000000000000000000000000',
        accounts[4],
        {from: accounts[1]}
      ).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(
        accounts[2],
        accounts[3],
        '0x0000000000000000000000000000000000000000',
        {from: accounts[1]}
      ).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(
        accounts[2],
        accounts[3],
        accounts[4],
        {from: accounts[1]}
      ).should.be.fulfilled;
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
    });
    it('should not allow passing the same key after it is already created', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[4], accounts[3], accounts[2], {from: accounts[1]}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[5], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[8], accounts[7], accounts[2], {from: accounts[5]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[8], accounts[3], accounts[6], {from: accounts[5]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[4], accounts[7], accounts[6], {from: accounts[5]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[8], accounts[7], accounts[6], {from: accounts[5]}).should.be.fulfilled;
    });
    it('should assign mining, voting, payout keys to relative mappings', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      const {logs} = await keysManager.createKeys(accounts[4], accounts[3], accounts[2], {from: accounts[1]}).should.be.fulfilled;
      true.should.be.equal(
        await keysManager.isMiningActive.call(accounts[4])
      )
      true.should.be.equal(
        await keysManager.isVotingActive.call(accounts[3])
      )
      true.should.be.equal(
        await keysManager.isPayoutActive.call(accounts[4])
      )
      // event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
      logs[0].event.should.be.equal('ValidatorInitialized');
      logs[0].args.miningKey.should.be.equal(accounts[4]);
      logs[0].args.votingKey.should.be.equal(accounts[3]);
      logs[0].args.payoutKey.should.be.equal(accounts[2]);
    });

    it('should assign voting <-> mining key and payout <-> mining key relationships', async () => {
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(accounts[4], accounts[3], accounts[2], {from: accounts[1]});
      accounts[4].should.be.equal(
        await keysManager.getMiningKeyByVoting.call(accounts[3])
      );
      accounts[4].should.be.equal(
        await keysManager.miningKeyByPayout.call(accounts[2])
      );
    });

    it('adds validator to poaConsensus contract', async () => {
      let miningKey = accounts[4];
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(miningKey, accounts[3], accounts[2], {from: accounts[1]});
      const index = await poaNetworkConsensusMock.getCurrentValidatorsLength.call();
      (await poaNetworkConsensusMock.pendingList.call(index)).should.be.equal(miningKey);
    })

    it('should set validatorKeys hash', async () => {
      let miningKey = accounts[4];
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(miningKey, accounts[3], accounts[2], {from: accounts[1]});
      const validatorKey = await keysManager.validatorKeys.call(miningKey);
      validatorKey.should.be.deep.equal([
        accounts[3],
        accounts[2],
        true,
        true,
        true
      ])
    })
    
    it('should set validatorKeys hash', async () => {
      let miningKey = accounts[4];
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(miningKey, accounts[3], accounts[2], {from: accounts[1]});
      new web3.BigNumber(2).should.be.bignumber.equal(await keysManager.getInitialKeyStatus.call(accounts[1]));
    })
  })

  describe('#addMiningKey', async () => {
    it('may only be called if KeysManager.init had been called before', async () => {
      await keysManager.setInitEnabled().should.be.fulfilled;
      await proxyStorageMock.setVotingContractMock(accounts[2]);
      await keysManager.addMiningKey(accounts[1], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
    });
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
      const validator = await keysManager.validatorKeys.call(accounts[2]);
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
    it('may only be called if KeysManager.init had been called before', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.setInitEnabled().should.be.fulfilled;
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.rejectedWith(ERROR_MSG);
    });
    it('may only be called if params are not the same', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[1], accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
    });
    it('should add VotingKey', async () => {
      await keysManager.addVotingKey(accounts[2],accounts[1], {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
      true.should.be.equal(await keysManager.isVotingActive.call(accounts[2]));
      logs[0].event.should.be.equal('VotingKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.miningKey.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('added');

      const miningKey = await keysManager.getMiningKeyByVoting.call(accounts[2]);
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
      false.should.be.equal(await keysManager.isVotingActive.call(accounts[2]));
      true.should.be.equal(await keysManager.isVotingActive.call(accounts[3]));
      const validator = await keysManager.validatorKeys.call(accounts[1]);
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
    it('may only be called if KeysManager.init had been called before', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.setInitEnabled().should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.rejectedWith(ERROR_MSG);
    });
    it('may only be called if params are not the same', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[1], accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
    });
    it('should add PayoutKey', async () => {
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      logs[0].event.should.be.equal('PayoutKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.miningKey.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('added');
      (await keysManager.miningKeyByPayout.call(accounts[2])).should.be.equal(
        accounts[1]
      );
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
      true.should.be.equal(await keysManager.isPayoutActive.call(accounts[1]));
      const validator = await keysManager.validatorKeys.call(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        accounts[3],
        true,
        false,
        true]
      );
      (await keysManager.miningKeyByPayout.call(accounts[3])).should.be.equal(
        accounts[1]
      );
      (await keysManager.miningKeyByPayout.call(accounts[2])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
    });
  })

  describe('#removeMiningKey', async () => {
    it('may only be called if KeysManager.init had been called before', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await keysManager.setInitEnabled().should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[1]).should.be.rejectedWith(ERROR_MSG);
    });
    it('should remove miningKey', async () => {
      await keysManager.removeMiningKey(accounts[1], {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys.call(accounts[1]);
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
      logs[1].event.should.be.equal('VotingKeyChanged');
      logs[1].args.key.should.be.equal(accounts[3]);
      logs[1].args.miningKey.should.be.equal(accounts[1]);
      logs[1].args.action.should.be.equal('removed');
      (await keysManager.getMiningKeyByVoting.call(validator[0])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
      (await keysManager.miningKeyByPayout.call(validator[1])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
      const result = await keysManager.removeVotingKey(accounts[1]).should.be.fulfilled;
      result.logs.length.should.be.equal(0);
      await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
    })
  
    it('removes validator from poaConsensus', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensusMock.getCurrentValidatorsLength.call();
      let pendingList = [];
      for(let i = 0; i < currentValidatorsLength.sub(1).toNumber(); i++){
          let pending = await poaNetworkConsensusMock.pendingList.call(i);
          pendingList.push(pending);
      }
      pendingList.should.not.contain(accounts[1]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators.call();
      validators.should.not.contain(accounts[1]);
      const expected = currentValidatorsLength.sub(1);
      const actual = await poaNetworkConsensusMock.getCurrentValidatorsLength.call();
      expected.should.be.bignumber.equal(actual);
    });

    it('removes MoC from poaConsensus', async () => {
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000001', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000002', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000003', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000004', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000005', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000006', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000007', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000008', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000009', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000010', {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000011', {from: masterOfCeremony}).should.be.fulfilled;
      
      await keysManager.removeMiningKey(masterOfCeremony).should.be.rejectedWith(ERROR_MSG);
      (await poaNetworkConsensusMock.isMasterOfCeremonyRemoved.call()).should.be.equal(false);
      (await keysManager.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensusMock.isValidator.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(1);

      await keysManager.initiateKeys('0x0000000000000000000000000000000000000012', {from: masterOfCeremony}).should.be.fulfilled;
      
      await keysManager.removeMiningKey(masterOfCeremony).should.be.fulfilled;
      (await poaNetworkConsensusMock.isMasterOfCeremonyRemovedPending.call()).should.be.equal(true);
      (await keysManager.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      
      (await poaNetworkConsensusMock.isMasterOfCeremonyRemovedPending.call()).should.be.equal(false);
      (await poaNetworkConsensusMock.isMasterOfCeremonyRemoved.call()).should.be.equal(true);
      (await keysManager.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensusMock.isValidator.call(masterOfCeremony)).should.be.equal(false);
      (await poaNetworkConsensusMock.getCurrentValidatorsLength.call()).should.be.bignumber.equal(0);
    });

    it('should still enforce removal of votingKey to 0x0 even if voting key did not exist', async () => {
      let result = await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      result.logs.length.should.be.equal(0);
      await proxyStorageMock.setVotingContractMock(masterOfCeremony);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      result = await keysManager.removeMiningKey(accounts[1]).should.be.fulfilled;
      result.logs[0].event.should.be.equal('MiningKeyChanged');
      result.logs[0].args.key.should.be.equal(accounts[1]);
      result.logs[0].args.action.should.be.equal('removed');
      const validator = await keysManager.validatorKeys.call(accounts[1]);
      (await keysManager.getMiningKeyByVoting.call(validator[0])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
      (await keysManager.miningKeyByPayout.call(validator[1])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
    })
  })

  describe('#removeVotingKey', async () => {
    it('may only be called if KeysManager.init had been called before', async () => {
      const {mining, voting, payout} = {mining: accounts[1], voting: accounts[3], payout: accounts[2]};
      await keysManager.addMiningKey(mining).should.be.fulfilled;
      await keysManager.addVotingKey(voting, mining).should.be.fulfilled;
      await keysManager.addPayoutKey(payout, mining).should.be.fulfilled;
      await keysManager.setInitEnabled().should.be.fulfilled;
      await keysManager.removeVotingKey(mining).should.be.rejectedWith(ERROR_MSG);
    });
    it('should be successful only for active voting key', async () => {
      const {mining, voting, payout} = {mining: accounts[1], voting: accounts[3], payout: accounts[2]};
      await keysManager.addMiningKey(mining).should.be.fulfilled;
      await keysManager.addPayoutKey(payout, mining).should.be.fulfilled;
      const result = await keysManager.removeVotingKey(mining).should.be.fulfilled;
      result.logs.length.should.be.equal(0);
      await keysManager.addVotingKey(voting, mining).should.be.fulfilled;
      const {logs} = await keysManager.removeVotingKey(mining).should.be.fulfilled;
      logs[0].event.should.be.equal('VotingKeyChanged');
      logs[0].args.key.should.be.equal(voting);
      logs[0].args.miningKey.should.be.equal(mining);
      logs[0].args.action.should.be.equal('removed');
    });
    it('should remove votingKey', async () => {
      const {mining, voting, payout} = {mining: accounts[1], voting: accounts[3], payout: accounts[2]};
      await keysManager.removeVotingKey(mining, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(mining).should.be.fulfilled;
      await keysManager.addVotingKey(voting, mining).should.be.fulfilled;
      await keysManager.addPayoutKey(payout, mining).should.be.fulfilled;
      const {logs} = await keysManager.removeVotingKey(mining).should.be.fulfilled;
      const validator = await keysManager.validatorKeys.call(mining);
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
      const miningKey = await keysManager.getMiningKeyByVoting.call(voting);
      miningKey.should.be.equal('0x0000000000000000000000000000000000000000');
    })
  })

  describe('#removePayoutKey', async () => {
    it('may only be called if KeysManager.init had been called before', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      await keysManager.setInitEnabled().should.be.fulfilled;
      await keysManager.removePayoutKey(accounts[1]).should.be.rejectedWith(ERROR_MSG);
    });
    it('should be successful only for active payout key', async () => {
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const result = await keysManager.removePayoutKey(accounts[1]).should.be.fulfilled;
      result.logs.length.should.be.equal(0);
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removePayoutKey(accounts[1]).should.be.fulfilled;
      logs[0].event.should.be.equal('PayoutKeyChanged');
      logs[0].args.key.should.be.equal(accounts[2]);
      logs[0].args.miningKey.should.be.equal(accounts[1]);
      logs[0].args.action.should.be.equal('removed');
    });
    it('should remove payoutKey', async () => {
      await keysManager.removePayoutKey(accounts[1], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const {logs} = await keysManager.removePayoutKey(accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys.call(accounts[1]);
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
      const miningKey = await keysManager.miningKeyByPayout.call(accounts[2]);
      miningKey.should.be.equal('0x0000000000000000000000000000000000000000');
    })
  })

  describe('#swapMiningKey', async () => {
    it('should swap mining key', async () => {
      await keysManager.swapMiningKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.swapMiningKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.swapMiningKey(accounts[4], accounts[3]).should.be.rejectedWith(ERROR_MSG);
      const validator = await keysManager.validatorKeys.call(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      const validatorNew = await keysManager.validatorKeys.call(accounts[2]);
      validatorNew.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        true,
        false,
        false]
      )
    });
    it('should swap MoC', async () => {
      (await keysManager.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensusMock.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      await keysManager.swapMiningKey(accounts[1], masterOfCeremony).should.be.fulfilled;
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      (await keysManager.masterOfCeremony.call()).should.be.equal(accounts[1]);
      (await poaNetworkConsensusMock.masterOfCeremony.call()).should.be.equal(accounts[1]);
      (await poaNetworkConsensusMock.isValidator.call(masterOfCeremony)).should.be.equal(false);
      (await poaNetworkConsensusMock.isValidator.call(accounts[1])).should.be.equal(true);
    });
    it('should keep voting and payout keys', async () => {
      const oldMining = accounts[1];
      const voting = accounts[2];
      const payout = accounts[3];
      const newMining = accounts[4];
      await keysManager.addMiningKey(oldMining).should.be.fulfilled;
      await keysManager.addVotingKey(voting, oldMining).should.be.fulfilled;
      await keysManager.addPayoutKey(payout, oldMining).should.be.fulfilled;
      const {logs} = await keysManager.swapMiningKey(newMining, oldMining).should.be.fulfilled;
      //const mining = await keysManager.getMiningKeyByVoting.call(voting);
      const validator = await keysManager.validatorKeys.call(oldMining);

      newMining.should.be.equal(await keysManager.getMiningKeyByVoting.call(voting));
      newMining.should.be.equal(await keysManager.miningKeyByPayout.call(payout));

      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false ]
      )
      const validatorNew = await keysManager.validatorKeys.call(newMining);
      validatorNew.should.be.deep.equal(
        [ voting,
        payout,
        true,
        true,
        true]
      )
      oldMining.should.be.equal(await keysManager.getMiningKeyHistory.call(newMining));
      await poaNetworkConsensusMock.setSystemAddress(accounts[0]);
      await poaNetworkConsensusMock.finalizeChange().should.be.fulfilled;
      const validators = await poaNetworkConsensusMock.getValidators.call();
      validators.should.not.contain(oldMining);
      validators.should.contain(newMining);
    })
  })

  describe('#swapVotingKey', async () => {
    it ('should swap voting key', async () => {
      await keysManager.swapVotingKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addVotingKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.swapVotingKey(accounts[3], accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys.call(accounts[1]);
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
    it('should swap payout key', async () => {
      await keysManager.swapPayoutKey(accounts[1], accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.addMiningKey(accounts[1]).should.be.fulfilled;
      await keysManager.addPayoutKey(accounts[2], accounts[1]).should.be.fulfilled;
      await keysManager.swapPayoutKey(accounts[3], accounts[1]).should.be.fulfilled;
      const validator = await keysManager.validatorKeys.call(accounts[1]);
      validator.should.be.deep.equal(
        [ '0x0000000000000000000000000000000000000000',
        accounts[3],
        true,
        false,
        true]
      );
      (await keysManager.miningKeyByPayout.call(accounts[2])).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
      (await keysManager.miningKeyByPayout.call(accounts[3])).should.be.equal(
        accounts[1]
      );
    });
  });

  describe('#migrateInitialKey', async () => {
    it('can copy initial keys', async () => {
      await keysManager.initiateKeys(accounts[1]);
      
      let newKeysManager = await KeysManagerMock.new();
      const newKeysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, newKeysManager.address);
      newKeysManager = await KeysManagerMock.at(newKeysManagerEternalStorage.address);
      await newKeysManager.init(keysManager.address).should.be.fulfilled;
      
      keysManager.address.should.be.equal(
        await newKeysManager.previousKeysManager.call()
      );

      let initialKeys = await newKeysManager.initialKeysCount.call();
      initialKeys.should.be.bignumber.equal(1);
      
      await newKeysManager.migrateInitialKey(
        accounts[1],
        {from: accounts[9]}
      ).should.be.rejectedWith(ERROR_MSG);
      await newKeysManager.migrateInitialKey(
        '0x0000000000000000000000000000000000000000'
      ).should.be.rejectedWith(ERROR_MSG);
      let {logs} = await newKeysManager.migrateInitialKey(accounts[1]).should.be.fulfilled;
      logs[0].event.should.equal("Migrated");
      logs[0].args.key.should.be.equal(accounts[1]);
      logs[0].args.name.should.be.equal("initialKey");
      await newKeysManager.migrateInitialKey(accounts[1]).should.be.rejectedWith(ERROR_MSG);

      new web3.BigNumber(1).should.be.bignumber.equal(
        await newKeysManager.getInitialKeyStatus.call(accounts[1])
      )
      await newKeysManager.migrateInitialKey(accounts[2]).should.be.rejectedWith(ERROR_MSG);
      new web3.BigNumber(0).should.be.bignumber.equal(
        await newKeysManager.getInitialKeyStatus.call(accounts[2])
      )
    })
  });

  describe('#migrateMiningKey', async () => {
    it('copies validator keys', async () => {
      const miningKey = accounts[2];
      const votingKey = accounts[3];
      const payoutKey = accounts[4];
      const miningKey2 = accounts[5];
      const miningKey3 = accounts[6];
      
      await proxyStorageMock.setVotingContractMock(accounts[0]);
      await keysManager.addMiningKey(miningKey2).should.be.fulfilled;
      await keysManager.swapMiningKey(miningKey3, miningKey2).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await keysManager.createKeys(miningKey, votingKey, payoutKey, {from: accounts[1]}).should.be.fulfilled;
      
      const validatorKeyFromOld = await keysManager.validatorKeys.call(miningKey);
      validatorKeyFromOld.should.be.deep.equal([
        votingKey,
        payoutKey,
        true,
        true,
        true
      ]);
      
      let newKeysManager = await KeysManagerMock.new();
      const newKeysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, newKeysManager.address);
      newKeysManager = await KeysManagerMock.at(newKeysManagerEternalStorage.address);
      await newKeysManager.init(keysManager.address).should.be.fulfilled;
      
      // mining #1
      await newKeysManager.migrateMiningKey(
        '0x0000000000000000000000000000000000000000',
        25
      ).should.be.rejectedWith(ERROR_MSG);
      await newKeysManager.migrateMiningKey(accounts[9], 25).should.be.rejectedWith(ERROR_MSG);
      let {logs} = await newKeysManager.migrateMiningKey(miningKey, 25).should.be.fulfilled;
      logs[0].event.should.equal("Migrated");
      logs[0].args.key.should.be.equal(miningKey);
      logs[0].args.name.should.be.equal("miningKey");
      await newKeysManager.migrateMiningKey(miningKey, 25).should.be.rejectedWith(ERROR_MSG);

      let initialKeys = await newKeysManager.initialKeysCount.call();
      initialKeys.should.be.bignumber.equal(1);
      const validatorKey = await newKeysManager.validatorKeys.call(miningKey);
      validatorKey.should.be.deep.equal([
        votingKey,
        payoutKey,
        true,
        true,
        true
      ]);
      true.should.be.equal(
        await newKeysManager.successfulValidatorClone.call(miningKey)
      );
      miningKey.should.be.equal(
        await newKeysManager.getMiningKeyByVoting.call(votingKey)
      );
      miningKey.should.be.equal(
        await newKeysManager.miningKeyByPayout.call(payoutKey)
      );
      true.should.be.equal(
        await newKeysManager.isMiningActive.call(miningKey)
      )
      true.should.be.equal(
        await newKeysManager.isVotingActive.call(votingKey)
      )
      true.should.be.equal(
        await newKeysManager.isPayoutActive.call(miningKey)
      )

      // mining #2
      await newKeysManager.migrateMiningKey(miningKey3, 25).should.be.fulfilled;
      const validatorKey2 = await newKeysManager.validatorKeys.call(miningKey3);
      validatorKey2.should.be.deep.equal([
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        true,
        false,
        false
      ]);
      true.should.be.equal(
        await newKeysManager.isMiningActive.call(miningKey3)
      );
      true.should.be.equal(
        await newKeysManager.successfulValidatorClone.call(miningKey3)
      );
      (await keysManager.getMiningKeyHistory.call(miningKey3)).should.be.equal(
        miningKey2
      );
      (await newKeysManager.getMiningKeyHistory.call(miningKey3)).should.be.equal(
        miningKey2
      );
    })
    it('throws when trying to copy invalid mining key', async () => {
      let newKeysManager = await KeysManagerMock.new();
      const newKeysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, newKeysManager.address);
      newKeysManager = await KeysManagerMock.at(newKeysManagerEternalStorage.address);
      await newKeysManager.init(keysManager.address).should.be.fulfilled;
      
      true.should.be.equal(
        await newKeysManager.successfulValidatorClone.call(masterOfCeremony)
      );
      await newKeysManager.migrateMiningKey(masterOfCeremony, 25).should.be.rejectedWith(ERROR_MSG);
    })
  });

  describe('#upgradeTo', async () => {
    const proxyStorageStubAddress = accounts[8];
    let keysManagerEternalStorage;
    beforeEach(async () => {
      keysManager = await KeysManagerMock.new();
      keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, keysManager.address);
      keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
      await keysManager.init(
        "0x0000000000000000000000000000000000000000"
      ).should.be.fulfilled;
      await keysManager.setProxyStorage(proxyStorageStubAddress);
    });
    it('may be called only by ProxyStorage', async () => {
      let keysManagerNew = await KeysManagerNew.new();
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
    });
    it('should change implementation address', async () => {
      let keysManagerNew = await KeysManagerNew.new();
      let oldImplementation = await keysManager.implementation.call();
      let newImplementation = keysManagerNew.address;
      (await keysManagerEternalStorage.implementation.call()).should.be.equal(oldImplementation);
      await keysManagerEternalStorage.upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      keysManagerNew = await KeysManagerNew.at(keysManagerEternalStorage.address);
      (await keysManagerNew.implementation.call()).should.be.equal(newImplementation);
      (await keysManagerEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let keysManagerNew = await KeysManagerNew.new();
      let oldVersion = await keysManager.version.call();
      let newVersion = oldVersion.add(1);
      (await keysManagerEternalStorage.version.call()).should.be.bignumber.equal(oldVersion);
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: proxyStorageStubAddress});
      keysManagerNew = await KeysManagerNew.at(keysManagerEternalStorage.address);
      (await keysManagerNew.version.call()).should.be.bignumber.equal(newVersion);
      (await keysManagerEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let keysManagerNew = await KeysManagerNew.new();
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: proxyStorageStubAddress});
      keysManagerNew = await KeysManagerNew.at(keysManagerEternalStorage.address);
      (await keysManagerNew.initialized.call()).should.be.equal(false);
      await keysManagerNew.initialize();
      (await keysManagerNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let keysManagerNew = await KeysManagerNew.new();
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: proxyStorageStubAddress});
      keysManagerNew = await KeysManagerNew.at(keysManagerEternalStorage.address);
      (await keysManagerNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      let keys = await keysManager.validatorKeys.call(accounts[2]);
      keys.should.be.deep.equal([
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        false,
        false,
        false
      ]);
      await keysManager.setProxyStorage(proxyStorageMock.address);
      await keysManager.initiateKeys(accounts[1], {from: masterOfCeremony}).should.be.fulfilled;
      await proxyStorageMock.setKeysManagerMock(keysManager.address);
      await keysManager.createKeys(accounts[2], accounts[3], accounts[4], {from: accounts[1]}).should.be.fulfilled;
      let keysManagerNew = await KeysManagerNew.new();
      await keysManager.setProxyStorage(proxyStorageStubAddress);
      await keysManagerEternalStorage.upgradeTo(keysManagerNew.address, {from: proxyStorageStubAddress});
      keysManagerNew = await KeysManagerNew.at(keysManagerEternalStorage.address);
      keys = await keysManagerNew.validatorKeys.call(accounts[2]);
      keys.should.be.deep.equal([accounts[3], accounts[4], true, true, true]);
    });
  });
});