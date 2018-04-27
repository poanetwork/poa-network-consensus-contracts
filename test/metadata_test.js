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
  if (typeof masterOfCeremony === 'undefined') {
  	masterOfCeremony = accounts[0];
  }
  votingKey = accounts[2];
  votingKey2 = accounts[3];
  miningKey = accounts[1];
  miningKey2 = accounts[4];
  miningKey3 = accounts[5];
  votingKey3 = accounts[7];
  beforeEach(async () => { 
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(masterOfCeremony, []);
    proxyStorageMock = await ProxyStorageMock.new(poaNetworkConsensusMock.address);
    keysManager = await KeysManagerMock.new(proxyStorageMock.address, poaNetworkConsensusMock.address, masterOfCeremony, "0x0000000000000000000000000000000000000000");
    
    let ballotsStorage = await BallotsStorage.new();
    const ballotsEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, ballotsStorage.address);
    ballotsStorage = await BallotsStorage.at(ballotsEternalStorage.address);
    await ballotsStorage.init(false).should.be.fulfilled;
    
    await poaNetworkConsensusMock.setProxyStorage(proxyStorageMock.address);

    metadata = await ValidatorMetadata.new();
    metadataEternalStorage = await EternalStorageProxy.new(proxyStorageMock.address, metadata.address);
    
    await proxyStorageMock.initializeAddresses(
      keysManager.address,
      masterOfCeremony,
      masterOfCeremony,
      masterOfCeremony,
      ballotsEternalStorage.address,
      metadataEternalStorage.address
    );
    
    metadata = await ValidatorMetadata.at(metadataEternalStorage.address);
    
    await keysManager.addMiningKey(miningKey).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey, miningKey).should.be.fulfilled;
    await keysManager.addMiningKey(miningKey2).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey2, miningKey2).should.be.fulfilled;
    await keysManager.addMiningKey(miningKey3).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey3, miningKey3).should.be.fulfilled;
    await metadata.setTime(55555);
  })
  describe('#createMetadata', async () => {
    it('happy path', async () => {
      const {logs} = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      const validators = await metadata.validators(miningKey);
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
      const validators = await metadata.validators(miningKey);
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
  })
  describe('#getMiningByVotingKey', async () => {
    it('happy path', async () => {
      let actual = await metadata.getMiningByVotingKey(votingKey);
      miningKey.should.be.equal(actual);
      actual = await metadata.getMiningByVotingKey(accounts[4]);
      '0x0000000000000000000000000000000000000000'.should.be.equal(actual);
    })
  })

  describe('#changeRequest', async () => {
    beforeEach(async () => {
      const {logs} = await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
    })
    it('happy path', async () => {
      await metadata.setTime(4444);
      const {logs} = await metadata.changeRequest(...newMetadata, {from: votingKey}).should.be.fulfilled;
      const pendingChanges = await metadata.pendingChanges(miningKey);
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
      let confirmations = await metadata.confirmations(miningKey);
      confirmations[0].should.be.bignumber.equal(2);
      const {logs} = await metadata.changeRequest(...anotherData, {from: votingKey}).should.be.fulfilled;
      confirmations = await metadata.confirmations(miningKey);
      confirmations[0].should.be.bignumber.equal(0);
      await metadata.confirmPendingChange(miningKey, {from: votingKey2});
      confirmations = await metadata.confirmations(miningKey);
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
      const pendingChanges = await metadata.pendingChanges(miningKey);
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
      const validators = await metadata.validators(miningKey);
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
      const pendingChanges = await metadata.pendingChanges(miningKey);
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
      const validators = await metadata.validators(miningKey);
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
      const confirmations = await metadata.confirmations(miningKey);
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
      const confirmations = await metadata.confirmations(miningKey);
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
      await metadata.confirmPendingChange(miningKey, {from: votingKey3});
      const {logs} = await metadata.finalize(miningKey, {from: votingKey});
      const validators = await metadata.validators(miningKey);
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
      const pendingChanges = await metadata.pendingChanges(miningKey);
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
      (await metadata.getMinThreshold()).should.be.bignumber.equal(2);
    })
  })
  describe('#setProxyAddress', async () => {
    let newProxy = "0xfb9c7fc2a00dffc53948e3bbeb11f3d4b56c31b8";
    it('can request a new proxy address', async () => {
      "0x0000000000000000000000000000000000000000".should.be.equal
        (await metadata.pendingProxyStorage());
      (await metadata.proxyStorage()).should.be.equal(proxyStorageMock.address);
	  await metadata.setProxyAddress(newProxy, {from: miningKey}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await metadata.setProxyAddress(newProxy, {from: votingKey}).should.be.fulfilled;
      (await metadata.pendingProxyStorage()).should.be.equal(newProxy);
      (await metadata.pendingProxyConfirmations(newProxy))[0].should.be.bignumber.deep.equal(1);
      logs[0].event.should.be.equal("RequestForNewProxy");
      logs[0].args.newProxyAddress.should.be.equal(newProxy);
      await metadata.confirmNewProxyAddress(newProxy, {from :votingKey2}).should.be.fulfilled;
      (await metadata.pendingProxyConfirmations(newProxy))[0].should.be.bignumber.deep.equal(2);
      let final = await metadata.confirmNewProxyAddress(newProxy, {from: votingKey3}).should.be.fulfilled;
      final.logs[0].event.should.be.equal("ChangeProxyStorage");
      final.logs[0].args.newProxyAddress.should.be.equal(newProxy);
      "0x0000000000000000000000000000000000000000".should.be.equal
        (await metadata.pendingProxyStorage());
      (await metadata.proxyStorage()).should.be.equal(newProxy);
    })
  })
  describe('#upgradeTo', async () => {
    const proxyStorageStubAddress = accounts[8];
    beforeEach(async () => {
      metadata = await ValidatorMetadata.new();
      metadataEternalStorage = await EternalStorageProxy.new(proxyStorageStubAddress, metadata.address);
      metadata = await ValidatorMetadata.at(metadataEternalStorage.address);
    });
    it('may be called only by ProxyStorage', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: proxyStorageStubAddress}).should.be.fulfilled;
    });
    it('should change implementation address', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      let oldImplementation = await metadata.implementation();
      let newImplementation = metadataNew.address;
      (await metadataEternalStorage.implementation()).should.be.equal(oldImplementation);
      await metadataEternalStorage.upgradeTo(newImplementation, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.implementation()).should.be.equal(newImplementation);
      (await metadataEternalStorage.implementation()).should.be.equal(newImplementation);
    });
    it('should increment implementation version', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      let oldVersion = await metadata.version();
      let newVersion = oldVersion.add(1);
      (await metadataEternalStorage.version()).should.be.bignumber.equal(oldVersion);
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.version()).should.be.bignumber.equal(newVersion);
      (await metadataEternalStorage.version()).should.be.bignumber.equal(newVersion);
    });
    it('new implementation should work', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.initialized()).should.be.equal(false);
      await metadataNew.initialize();
      (await metadataNew.initialized()).should.be.equal(true);
    });
    it('new implementation should use the same proxyStorage address', async () => {
      let metadataNew = await ValidatorMetadataNew.new();
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      (await metadataNew.proxyStorage()).should.be.equal(proxyStorageStubAddress);
    });
    it('new implementation should use the same storage', async () => {
      await metadata.setTime(55555);
      await metadataEternalStorage.setProxyStorage(proxyStorageMock.address);
      await metadata.createMetadata(...fakeData, {from: votingKey}).should.be.fulfilled;
      await metadataEternalStorage.setProxyStorage(proxyStorageStubAddress);
      let metadataNew = await ValidatorMetadataNew.new();
      await metadataEternalStorage.upgradeTo(metadataNew.address, {from: proxyStorageStubAddress});
      metadataNew = await ValidatorMetadataNew.at(metadataEternalStorage.address);
      const validators = await metadataNew.validators(miningKey);
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

var toUtf8 = function(hex) {
  var buf = new Buffer(hex.replace('0x',''),'hex');
  return buf.toString();
}

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