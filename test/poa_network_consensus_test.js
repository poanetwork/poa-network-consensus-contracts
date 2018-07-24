let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let EternalStorageProxy = artifacts.require('./EternalStorageProxy');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('PoaNetworkConsensus [all features]', function (accounts) {
  let poaNetworkConsensus;
  let proxyStorageMock;
  let masterOfCeremony = accounts[0];
  beforeEach(async () => {
    await PoaNetworkConsensus.new('0x0000000000000000000000000000000000000000', []).should.be.rejectedWith(ERROR_MSG);
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony, []).should.be.fulfilled;;
    
    proxyStorageMock = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorageMock.address);
    proxyStorageMock = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorageMock.init(poaNetworkConsensus.address).should.be.fulfilled;
    
    await poaNetworkConsensus.setProxyStorage(proxyStorageMock.address).should.be.fulfilled;
    await poaNetworkConsensus.setProxyStorage(proxyStorageMock.address).should.be.rejectedWith(ERROR_MSG);
    
    await proxyStorageMock.initializeAddresses(
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0]
    );
  });

  describe('default values', async () => {
    it('finalized should be false', async () => {
      let validators = await poaNetworkConsensus.getValidators.call();
      let finalized = await poaNetworkConsensus.finalized.call();
      validators.should.be.deep.equal([
        masterOfCeremony
      ]);
      finalized.should.be.false;
    });

    it('checks systemAddress', async () => {
      let systemAddress = await poaNetworkConsensus.systemAddress.call();
      systemAddress.should.be.equal('0xfffffffffffffffffffffffffffffffffffffffe');
    })
    it('allows you to set current list of validators', async () => {
      let validatorsList = [accounts[2], accounts[3], accounts[4]];
      let poa = await PoaNetworkConsensus.new(masterOfCeremony, validatorsList);
      let validators = await poa.getValidators.call();
      let finalized = await poa.finalized.call();
      validators.should.be.deep.equal([
        masterOfCeremony,
        ...validatorsList
      ]);
    })
  })

  describe('#finalizeChange', async () => {
    it('should only be called by systemAddress', async () => {
      await poaNetworkConsensus.finalizeChange().should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.finalizeChange().should.be.rejectedWith(ERROR_MSG);
    })
    it('should set finalized to true', async () => {
      let finalized = await poaNetworkConsensus.finalized.call();
      finalized.should.be.false;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      finalized = await poaNetworkConsensus.finalized.call();
      finalized.should.be.true;
    })
    it('should set currentValidators to pendingList', async () => {
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      const { logs } = await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call();
      let currentValidators = [];
      let pendingList = [];
      for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
        let validator = await poaNetworkConsensus.currentValidators.call(i);
        currentValidators.push(validator);
        let pending = await poaNetworkConsensus.pendingList.call(i);
        pendingList.push(pending);
      }
      currentValidators.should.be.deep.equal(pendingList);
      logs[0].event.should.be.equal('ChangeFinalized');
      logs[0].args.newSet.should.be.deep.equal(currentValidators);
    })

    it('set currentValidators to pendingList after addValidator call', async () => {
      await poaNetworkConsensus.addValidator(accounts[1], true, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.addValidator(accounts[1], true);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call();
      let currentValidators = [];
      let pendingList = [];
      for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
        let validator = await poaNetworkConsensus.currentValidators.call(i);
        currentValidators.push(validator);
        let pending = await poaNetworkConsensus.pendingList.call(i);
        pendingList.push(pending);
      }
      currentValidators.should.be.deep.equal(pendingList);
      await poaNetworkConsensus.addValidator(accounts[2], true);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call()
      const expected = [masterOfCeremony, accounts[1], accounts[2]];

      currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call();
      currentValidators = [];
      pendingList = [];
      for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
        let validator = await poaNetworkConsensus.currentValidators.call(i);
        currentValidators.push(validator);
        let pending = await poaNetworkConsensus.pendingList.call(i);
        pendingList.push(pending);
      }
      expected.should.be.deep.equal(pendingList);
      expected.should.be.deep.equal(currentValidators);
    })
  })

  describe('#addValidator', async () => {
    it('should be called only from keys manager', async () => {
      await poaNetworkConsensus.addValidator(accounts[1], true, {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
      await proxyStorageMock.setKeysManagerMock(accounts[5]);
      await poaNetworkConsensus.addValidator(accounts[1], true, {from: accounts[5]}).should.be.fulfilled;
    })

    it('should not allow to add already existing validator', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow 0x0 addresses', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator('0x0', true).should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.addValidator('0x0000000000000000000000000000000000000000', true).should.be.rejectedWith(ERROR_MSG);
    })

    it('should set validatorsState for new validator', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      let state = await poaNetworkConsensus.validatorsState.call(accounts[1]);
      let pendingList = await poaNetworkConsensus.getPendingList.call();
      state[0].should.be.true;
      state[2].should.be.bignumber.equal(pendingList.length - 1)
    })

    it('should set finalized to false', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      let finalized = await poaNetworkConsensus.finalized.call();
      finalized.should.be.false;
    })

    it('should emit InitiateChange with blockhash and pendingList as params', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      const {logs} = await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call();
      let currentValidators = [];
      for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
        let validator = await poaNetworkConsensus.currentValidators.call(i);
        currentValidators.push(validator);
      }
      currentValidators.push(accounts[1]);
      logs[0].args['newSet'].should.deep.equal(currentValidators);  
      logs[0].event.should.be.equal('InitiateChange');
    })
  })

  describe('#swapValidatorKey', async () => {
    it('should swap validator key', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);

      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;

      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(2);
      (await poaNetworkConsensus.isValidator.call(accounts[1])).should.be.equal(true);
      (await poaNetworkConsensus.isValidator.call(accounts[2])).should.be.equal(false);
      
      await poaNetworkConsensus.swapValidatorKey(accounts[2], accounts[3]).should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.swapValidatorKey(accounts[2], accounts[1]).should.be.fulfilled;
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;

      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(2);
      (await poaNetworkConsensus.isValidator.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.isValidator.call(accounts[2])).should.be.equal(true);
    });
    it('should swap MoC', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);

      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(1);
      (await poaNetworkConsensus.isValidator.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.isValidator.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensus.masterOfCeremonyPending.call()).should.be.equal('0x0000000000000000000000000000000000000000');
      
      await poaNetworkConsensus.swapValidatorKey(accounts[1], masterOfCeremony).should.be.fulfilled;
      (await poaNetworkConsensus.masterOfCeremonyPending.call()).should.be.equal(accounts[1]);
      (await poaNetworkConsensus.isMasterOfCeremonyRemovedPending.call()).should.be.equal(false);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;

      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(1);
      (await poaNetworkConsensus.isValidator.call(masterOfCeremony)).should.be.equal(false);
      (await poaNetworkConsensus.isValidator.call(accounts[1])).should.be.equal(true);
      (await poaNetworkConsensus.masterOfCeremony.call()).should.be.equal(accounts[1]);
      (await poaNetworkConsensus.masterOfCeremonyPending.call()).should.be.equal('0x0000000000000000000000000000000000000000');
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(false);
      (await poaNetworkConsensus.isMasterOfCeremonyRemovedPending.call()).should.be.equal(false);
    });
  });

  describe('#removeValidator', async () => {
    it('should remove validator', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.removeValidator(accounts[1], true).should.be.fulfilled;
    })

    it('should remove MoC', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      (await poaNetworkConsensus.isValidator.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(false);
      (await poaNetworkConsensus.isMasterOfCeremonyRemovedPending.call()).should.be.equal(false);
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(1);
      await poaNetworkConsensus.removeValidator(masterOfCeremony, true).should.be.fulfilled;
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(false);
      (await poaNetworkConsensus.isMasterOfCeremonyRemovedPending.call()).should.be.equal(true);
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.getCurrentValidatorsLength.call()).should.be.bignumber.equal(0);
      (await poaNetworkConsensus.isValidator.call(masterOfCeremony)).should.be.equal(false);
      (await poaNetworkConsensus.masterOfCeremony.call()).should.be.equal(masterOfCeremony);
      (await poaNetworkConsensus.isMasterOfCeremonyRemoved.call()).should.be.equal(true);
      (await poaNetworkConsensus.isMasterOfCeremonyRemovedPending.call()).should.be.equal(false);
    })

    it('should be called only from keys manager', async () => {
      await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.rejectedWith(ERROR_MSG);
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.fulfilled;
    })

    it('should only be allowed to remove from existing set of validators', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.rejectedWith(ERROR_MSG);
    })

    it('should decrease length of pendingList', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      await poaNetworkConsensus.addValidator(accounts[2], true).should.be.fulfilled;
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      let currentValidatorsLength = await poaNetworkConsensus.getCurrentValidatorsLength.call();
      let pendingList = [];
      for(let i = 0; i < currentValidatorsLength; i++){
        let pending = await poaNetworkConsensus.pendingList.call(i);
        pendingList.push(pending);
      }
      const indexOfRemovedElement = pendingList.indexOf(accounts[1]);
      pendingList.splice(indexOfRemovedElement, 1);
      const { logs } = await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.fulfilled;
      let pendingListFromContract = logs[0].args['newSet'];
      pendingListFromContract.length.should.be.equal(currentValidatorsLength.toNumber(10) - 1);
      pendingList.should.be.deep.equal(pendingListFromContract);
      logs[0].event.should.be.equal('InitiateChange');
      const expected = [masterOfCeremony, accounts[2]];
      expected.should.be.deep.equal(pendingList);
    })

    it('should change validatorsState', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.fulfilled;
      const state = await poaNetworkConsensus.validatorsState.call(accounts[1]);
      state[0].should.be.false;
      state[2].should.be.bignumber.equal(0);
    })

    it('should set finalized to false', async () => {
      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      await poaNetworkConsensus.addValidator(accounts[1], true).should.be.fulfilled;
      await poaNetworkConsensus.removeValidator(accounts[1],true).should.be.fulfilled;
      const finalized = await poaNetworkConsensus.finalized.call();
      finalized.should.be.false;
    })
  });

  describe('#setProxyStorage', async () => {
    let new_masterOfCeremony = accounts[1];
    const nonValidator = accounts[3];
    let validator = accounts[0];
    it('can be called by any validator', async () => {
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      await poaNetworkConsensus.setProxyStorage(nonValidator, {from: accounts[6]}).should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.setProxyStorage(accounts[5], {from: validator}).should.be.fulfilled;
    })
    it('can only be called once', async () => {
      // we already call it in the beforeEach block, hence why I expect it to be rejected
      await poaNetworkConsensus.setProxyStorage(nonValidator, {from: nonValidator}).should.be.rejectedWith(ERROR_MSG);
    })
    it('cannot be set to 0x0 address', async () => {
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      await poaNetworkConsensus.setProxyStorage('0x0000000000000000000000000000000000000000', {from: validator}).should.be.rejectedWith(ERROR_MSG);
    })
    it('sets proxyStorage', async () => {
      let newProxyStorage = accounts[3];
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: validator}).should.be.fulfilled;
      (await poaNetworkConsensus.proxyStorage.call()).should.be.equal(newProxyStorage);
    })
    it('sets isMasterOfCeremonyInitialized', async () => {
      let newProxyStorage = accounts[3];
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: validator}).should.be.fulfilled;
      (await poaNetworkConsensus.isMasterOfCeremonyInitialized.call()).should.be.equal(true);
    })

    it('emits MoCInitializedProxyStorage', async () => {
      let newProxyStorage = accounts[3];
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      const {logs} = await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: validator}).should.be.fulfilled;
      logs[0].event.should.be.equal('MoCInitializedProxyStorage');
      logs[0].args.proxyStorage.should.be.equal(newProxyStorage);
    })
    it('#getKeysManager', async () => {
      let newKeysManager = accounts[3];
      await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
      await proxyStorageMock.setKeysManagerMock(newKeysManager);
      (await poaNetworkConsensus.getKeysManager.call()).should.be.equal(newKeysManager);
    })
  })

  describe('#isValidator', async () => {
    it('returns true for validator', async () => {
      (await poaNetworkConsensus.isValidator.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.isValidator.call(accounts[2])).should.be.equal(false);
    });
  });

  describe('#isValidatorFinalized', async () => {
    it('returns true for finalized validator', async () => {
      (await poaNetworkConsensus.isValidatorFinalized.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(masterOfCeremony))[1].should.be.equal(true);
      for (let i = 1; i <= 4; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(false);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(false);
      }

      await poaNetworkConsensus.setSystemAddress(accounts[0]);
      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      (await poaNetworkConsensus.finalized.call()).should.be.true;

      (await poaNetworkConsensus.isValidatorFinalized.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(masterOfCeremony))[1].should.be.equal(true);
      for (let i = 1; i <= 4; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(false);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(false);
      }

      for (let i = 1; i <= 4; i++) {
        await poaNetworkConsensus.addValidator(accounts[i], true).should.be.fulfilled;
      }

      for (let i = 1; i <= 4; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(false);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(false);
      }

      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
      
      for (let i = 1; i <= 4; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(true);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(true);
      }

      (await poaNetworkConsensus.getValidators.call()).should.be.deep.equal(
        await poaNetworkConsensus.getPendingList.call()
      );

      (await poaNetworkConsensus.getValidators.call()).should.be.deep.equal([
        masterOfCeremony, accounts[1], accounts[2], accounts[3], accounts[4]
      ]);

      await poaNetworkConsensus.swapValidatorKey(accounts[5], accounts[1]).should.be.fulfilled;

      (await poaNetworkConsensus.getValidators.call()).should.not.be.deep.equal(
        await poaNetworkConsensus.getPendingList.call()
      );

      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[1]))[1].should.be.equal(false);
      for (let i = 2; i <= 4; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(true);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(true);
      }
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[5])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[5]))[1].should.be.equal(false);

      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;

      (await poaNetworkConsensus.getValidators.call()).should.be.deep.equal(
        await poaNetworkConsensus.getPendingList.call()
      );

      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[1]))[1].should.be.equal(false);
      for (let i = 2; i <= 5; i++) {
        (await poaNetworkConsensus.isValidatorFinalized.call(accounts[i])).should.be.equal(true);
        (await poaNetworkConsensus.validatorsState.call(accounts[i]))[1].should.be.equal(true);
      }

      await poaNetworkConsensus.removeValidator(accounts[1], true).should.be.rejectedWith(ERROR_MSG);
      await poaNetworkConsensus.removeValidator(accounts[3], true).should.be.fulfilled;

      (await poaNetworkConsensus.isValidatorFinalized.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(masterOfCeremony))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[1]))[1].should.be.equal(false);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[2])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[2]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[3])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[3]))[1].should.be.equal(false);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[4])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[4]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[5])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[5]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[6])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[6]))[1].should.be.equal(false);

      await poaNetworkConsensus.finalizeChange().should.be.fulfilled;

      (await poaNetworkConsensus.isValidatorFinalized.call(masterOfCeremony)).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(masterOfCeremony))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[1])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[1]))[1].should.be.equal(false);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[2])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[2]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[3])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[3]))[1].should.be.equal(false);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[4])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[4]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[5])).should.be.equal(true);
      (await poaNetworkConsensus.validatorsState.call(accounts[5]))[1].should.be.equal(true);
      (await poaNetworkConsensus.isValidatorFinalized.call(accounts[6])).should.be.equal(false);
      (await poaNetworkConsensus.validatorsState.call(accounts[6]))[1].should.be.equal(false);

      (await poaNetworkConsensus.getValidators.call()).should.be.deep.equal([
        masterOfCeremony, accounts[4], accounts[2], accounts[5]
      ]);
    });
  });
});