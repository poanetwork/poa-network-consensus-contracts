let PoaNetworkConsensusMock = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./mockContracts/KeysManagerMock');
let ValidatorMetadata = artifacts.require('./mockContracts/ValidatorMetadataMock');
let ValidatorMetadataNew = artifacts.require('./upgradeContracts/ValidatorMetadataNew');
let BallotsStorage = artifacts.require('./BallotsStorage');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let EternalStorageProxy = artifacts.require('./mockContracts/EternalStorageProxyMock');
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

let keysManager, poaNetworkConsensusMock;
let metadata, metadataEternalStorage;
let votingKey, votingKey2, votingKey3, miningKey;
let fakeData = [
  "Djamshut", "Roosvelt", "123asd", "Moskva", "ZZ", "234", 23423
];
let newMetadata = [
  "Feodosiy", "Kennedy", "123123", "Petrovka 38", "ZA", "1337", 71
];
let anotherData = [
  "Feodosiy", "Bush", "123123", "Petrovka 38", "ZA", "1337", 71
];
contract('ValidatorMetadata [all features]', function (accounts) {
  beforeEach(async () => {
    if (typeof masterOfCeremony === 'undefined') {
      masterOfCeremony = accounts[0];
    }
    votingKey = accounts[2];
    votingKey2 = accounts[3];
    miningKey = accounts[1];
    miningKey2 = accounts[4];
    miningKey3 = accounts[5];
    votingKey3 = accounts[7];

    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony, []);
    
    proxyStorageMock = await ProxyStorageMock.new();
    const proxyStorageEternalStorage = await EternalStorageProxy.new(0, proxyStorageMock.address);
    proxyStorageMock = await ProxyStorageMock.at(proxyStorageEternalStorage.address);
    await proxyStorageMock.init(poaNetworkConsensusMock.address).should.be.fulfilled;
    
    keysManager = await KeysManagerMock.new();
    const keysManagerEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, keysManager.address);
    keysManager = await KeysManagerMock.at(keysManagerEternalStorage.address);
    await keysManager.init(
      "0x0000000000000000000000000000000000000000"
    ).should.be.fulfilled;
    
    let ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init([3, 2]).should.be.fulfilled;
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);

    metadata = await ValidatorMetadata.new();
    metadataEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, metadata.address);
    metadata = await ValidatorMetadata.at(metadataEternalStorage.address);
    
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      accounts[0],
      accounts[0],
      accounts[0],
      accounts[0],
      ballotsEternalStorage.address,
      metadataEternalStorage.address,
      accounts[0]
    );
    
    await addMiningKey(miningKey);
    await addVotingKey(votingKey, miningKey);
    await addMiningKey(miningKey2);
    await addVotingKey(votingKey2, miningKey2);
    await addMiningKey(miningKey3);
    await addVotingKey(votingKey3, miningKey3);

    await metadata.setTime(55555);
  });

  describe('#createMetadata', async () => {
    it('happy path', async () => {
      (await metadata.getTime.call()).should.be.bignumber.equal(55555);
      const {logs} = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      const validators = await metadata.validators.call(miningKey);
      validators.should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
      logs[0].event.should.be.equal('MetadataCreated');
      logs[0].args.miningKey.should.be.equal(miningKey);
    })
    it('should not let create metadata if called by non-voting key', async () => {
      const {logs} = await metadata.createMetadata(...fakeData, {from: miningKey}).should.be.rejectedWith(ERROR_MSG);
      const validators = await metadata.validators.call(miningKey);
      validators.should.be.deep.equal([
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        "",
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);
    })
    it('should not let create metadata if called second time', async () => {
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#clearMetadata', async () => {
    it('happy path', async () => {
      let result = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      (await metadata.validators.call(miningKey)).should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
      result.logs[0].event.should.be.equal('MetadataCreated');
      result.logs[0].args.miningKey.should.be.equal(miningKey);

      await metadata.setTime(4444);
      result = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      (await metadata.pendingChanges.call(miningKey)).should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
      result.logs[0].event.should.be.equal("ChangeRequestInitiated");
      result.logs[0].args.miningKey.should.be.equal(miningKey);

      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      result = await metadata.clearMetadata(miningKey);
      result.logs[0].event.should.be.equal('MetadataCleared');
      result.logs[0].args.miningKey.should.be.equal(miningKey);
      await proxyStorageMock.setKeysManagerMock(keysManager.address);

      (await metadata.validators.call(miningKey)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);

      (await metadata.pendingChanges.call(miningKey)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);
    });
  });

  describe('#moveMetadata', async () => {
    it('happy path', async () => {
      let result = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      (await metadata.validators.call(miningKey)).should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
      result.logs[0].event.should.be.equal('MetadataCreated');
      result.logs[0].args.miningKey.should.be.equal(miningKey);

      await metadata.setTime(4444);
      result = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      (await metadata.pendingChanges.call(miningKey)).should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
      result.logs[0].event.should.be.equal("ChangeRequestInitiated");
      result.logs[0].args.miningKey.should.be.equal(miningKey);

      (await metadata.validators.call(miningKey2)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);

      (await metadata.pendingChanges.call(miningKey2)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);

      await proxyStorageMock.setKeysManagerMock(accounts[0]);
      result = await metadata.moveMetadata(miningKey, miningKey2);
      result.logs[0].event.should.be.equal('MetadataMoved');
      result.logs[0].args.oldMiningKey.should.be.equal(miningKey);
      result.logs[0].args.newMiningKey.should.be.equal(miningKey2);
      await proxyStorageMock.setKeysManagerMock(keysManager.address);

      (await metadata.validators.call(miningKey)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);

      (await metadata.pendingChanges.call(miningKey)).should.be.deep.equal([
        toHex(""),
        toHex(""),
        toHex(""),
        "",
        toHex(""),
        toHex(""),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);

      (await metadata.validators.call(miningKey2)).should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);

      (await metadata.pendingChanges.call(miningKey2)).should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
    });
  });

  describe('#initMetadata', async () => {
    it('happy path', async () => {
      let validatorData = [
        "Djamshut", // bytes32 _firstName
        "Roosvelt", // bytes32 _lastName
        "123asd",   // bytes32 _licenseId
        "Moskva",   // string _fullAddress
        "ZZ",       // bytes32 _state
        "234",      // bytes32 _zipcode
        23423,      // uint256 _expirationDate
        123,        // uint256 _createdDate
        0,          // uint256 _updatedDate
        3,          // uint256 _minThreshold
        accounts[8] // address _miningKey
      ];

      await metadata.initMetadata(...validatorData, {from: accounts[8]}).should.be.rejectedWith(ERROR_MSG);
      await metadata.initMetadata(...validatorData).should.be.rejectedWith(ERROR_MSG);
      validatorData[10] = miningKey;
      await metadata.initMetadata(...validatorData).should.be.fulfilled;
      await metadata.initMetadata(...validatorData).should.be.rejectedWith(ERROR_MSG);

      (await metadata.validators.call(miningKey)).should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(123),
        new web3.BigNumber(0),
        new web3.BigNumber(3)
      ]);

      validatorData[7] = 0;
      validatorData[10] = miningKey2;
      await metadata.initMetadata(...validatorData).should.be.rejectedWith(ERROR_MSG);
      validatorData[7] = 123;
      await metadata.initMetadata(...validatorData).should.be.fulfilled;

      (await metadata.validators.call(miningKey2)).should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(123),
        new web3.BigNumber(0),
        new web3.BigNumber(3)
      ]);

      validatorData[10] = miningKey3;
      await metadata.initMetadataDisable({from: accounts[8]}).should.be.rejectedWith(ERROR_MSG);
      await metadata.initMetadataDisable().should.be.fulfilled;
      (await metadata.initMetadataDisabled.call()).should.be.equal(true);
      await metadata.initMetadata(...validatorData).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#changeRequest', async () => {
    beforeEach(async () => {
      const {logs} = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
    })
    it('happy path', async () => {
      await metadata.setTime(4444);
      const {logs} = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      const pendingChanges = await metadata.pendingChanges.call(miningKey);
      pendingChanges.should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
      logs[0].event.should.be.equal("ChangeRequestInitiated");
      logs[0].args.miningKey.should.be.equal(miningKey);
    })
    it('should not let call if there is no metadata', async () => {
      await metadata.changeRequest(...newMetadata, {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('resets confirmations when changeRequest recreated', async () => {
      await metadata.setTime(4444);
      await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      await metadata.confirmPendingChange(miningKey, {from: votingKey2});
      await metadata.confirmPendingChange(miningKey, {from: votingKey3});
      let confirmations = await metadata.confirmations.call(miningKey);
      confirmations[0].should.be.bignumber.equal(2);
      const {logs} = await metadata.changeRequest(...anotherData, {from: votingKey}).should.be.fulfilled;
      confirmations = await metadata.confirmations.call(miningKey);
      confirmations[0].should.be.bignumber.equal(0);
      await metadata.confirmPendingChange(miningKey, {from: votingKey2});
      confirmations = await metadata.confirmations.call(miningKey);
      confirmations[0].should.be.bignumber.equal(1);
    })
  })

  describe('#cancelPendingChange', async () => {
    it('happy path', async () => {
      await metadata.cancelPendingChange({from: votingKey}).should.be.fulfilled;
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.setTime(4444);
      const {logs} = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      await metadata.cancelPendingChange({from: votingKey}).should.be.fulfilled;
      const pendingChanges = await metadata.pendingChanges.call(miningKey);
      pendingChanges.should.be.deep.equal([
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        "",
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);
      const validators = await metadata.validators.call(miningKey);
      validators.should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
      logs[0].event.should.be.equal("ChangeRequestInitiated");
      logs[0].args.miningKey.should.be.equal(miningKey);
    })
    it('should not let delete records for someone else miningKey', async () => {
      await metadata.cancelPendingChange({from: votingKey}).should.be.fulfilled;
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.setTime(4444);
      const {logs} = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      await metadata.cancelPendingChange({from: votingKey2}).should.be.fulfilled;
      const pendingChanges = await metadata.pendingChanges.call(miningKey);
      pendingChanges.should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
      const validators = await metadata.validators.call(miningKey);
      validators.should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
    });
  })
  describe('#confirmPendingChange', async ()=> {
    it('should not let confirm your own changes', async ()=> {
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      await metadata.confirmPendingChange(miningKey, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
    });
    it('should confirm changes', async ()=> {
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      const {logs} = await metadata.confirmPendingChange(miningKey, {from: votingKey2}).should.be.fulfilled;
      const confirmations = await metadata.confirmations.call(miningKey);
      confirmations[0].should.be.bignumber.equal(1);
      logs[0].event.should.be.equal('Confirmed');
      logs[0].args.miningKey.should.be.equal(miningKey);
      logs[0].args.votingSender.should.be.equal(votingKey2);
    });
    it('prevent from double voting', async () => {
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      const {logs} = await metadata.confirmPendingChange(miningKey, {from: votingKey2}).should.be.fulfilled;
      await metadata.confirmPendingChange(miningKey, {from: votingKey2}).should.be.rejectedWith(ERROR_MSG);
      const confirmations = await metadata.confirmations.call(miningKey);
      confirmations[0].should.be.bignumber.equal(1);
    })
  });
  describe('#finalize', async ()=> {
    it('happy path', async ()=> {
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadata.setTime(4444);
      await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      await metadata.confirmPendingChange(miningKey, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await metadata.confirmPendingChange(miningKey, {from: votingKey2});
      await metadata.finalize(miningKey, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      await metadata.confirmPendingChange(miningKey, {from: votingKey3});
      const {logs} = await metadata.finalize(miningKey, {from: votingKey}).should.be.fulfilled;
      await metadata.finalize(miningKey2, {from: votingKey}).should.be.rejectedWith(ERROR_MSG);
      const validators = await metadata.validators.call(miningKey);
      validators.should.be.deep.equal([
        toHex("Feodosiy"),
        toHex("Kennedy"),
        pad(web3.toHex("123123")),
        "Petrovka 38",
        toHex("ZA"),
        pad(web3.toHex("1337")),
        new web3.BigNumber(71),
        new web3.BigNumber(55555),
        new web3.BigNumber(4444),
        new web3.BigNumber(2)
      ]);
      const pendingChanges = await metadata.pendingChanges.call(miningKey);
      pendingChanges.should.be.deep.equal([
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        "",
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0),
        new web3.BigNumber(0)
      ]);
      logs[0].event.should.be.equal('FinalizedChange');
      logs[0].args.miningKey.should.be.equal(miningKey);
    });
  });

  describe('#getMinThreshold', async () => {
    it('returns default value', async () => {
      (await metadata.getMinThreshold.call()).should.be.bignumber.equal(2);
    })
  })

  describe('#upgradeTo', async () => {
    let proxyStorageStubAddress;
    let metadataOldImplementation;
    beforeEach(async () => {
      proxyStorageStubAddress = accounts[8];
      metadata = await ValidatorMetadata.new();
      metadataOldImplementation = metadata.address;
      metadataEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, metadata.address);
      metadata = await ValidatorMetadata.at(metadataEternalStorage.address);
    });
    it('may only be called by ProxyStorage', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
    });
    it('should change implementation address', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      let newImplementation = metadataNew.address;
      (await metadataEternalStorage.implementation.call()).should.be.equal(metadataOldImplementation);
      await upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      (await metadataEternalStorage.implementation.call()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      let oldVersion = await metadataEternalStorage.version.call();
      let newVersion = oldVersion.add(1);
      await upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      (await metadataEternalStorage.version.call()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.initialized.call()).should.be.equal(false);
      await metadataNew.initialize();
      (await metadataNew.initialized.call()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.proxyStorage.call()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      await metadata.setTime(55555);
      await metadataEternalStorage.setProxyStorage(proxyStorageMock.address);
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadataEternalStorage.setProxyStorage(proxyStorageStubAddress);
      let metadataNew = await ValidatorMetadataNew.new();
      await upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      const validators = await metadataNew.validators.call(miningKey);
      validators.should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Roosvelt"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        pad(web3.toHex("234")),
        new web3.BigNumber(23423),
        new web3.BigNumber(55555),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ]);
    });
  });
})

function toHex(someString) {
  var hex = '0x' + new Buffer(someString).toString('hex');
  hex = pad(hex);
  return hex;
}

function pad(hex) {
  while(hex.length !== 66){
    hex = hex + '0';
  }
  return hex;
}

async function addMiningKey(_key) {
  const {logs} = await keysManager.addMiningKey(_key);
  logs[0].event.should.be.equal("MiningKeyChanged");
}

async function addVotingKey(_key, _miningKey) {
  const {logs} = await keysManager.addVotingKey(_key, _miningKey);
  logs[0].event.should.be.equal("VotingKeyChanged");
}

async function upgradeTo(implementation, options) {
  const {logs} = await metadataEternalStorage.upgradeTo(implementation, options);
  logs[0].event.should.be.equal("Upgraded");
}
