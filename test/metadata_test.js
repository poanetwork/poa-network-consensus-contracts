let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./KeysManagerMock');
let ValidatorMetadata = artifacts.require('./ValidatorMetadataMock');
let BallotsStorage = artifacts.require('./BallotsStorage');
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

let keysManager, ballotsStorage, poaNetworkConsensusMock, metadata;
let votingKey, votingKey2, votingKey3, miningKey;
contract('Voting to change keys [all features]', function (accounts) {
  votingKey = accounts[2];
  miningKey = accounts[1];
  beforeEach(async () => { 
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(accounts[0]);
    keysManager = await KeysManagerMock.new(accounts[0], accounts[0], poaNetworkConsensusMock.address);
    ballotsStorage = await BallotsStorage.new(accounts[0]);
    metadata = await ValidatorMetadata.new(keysManager.address, ballotsStorage.address);
    await poaNetworkConsensusMock.setKeysManagerMock(keysManager.address);
    await keysManager.setVotingContractMock(accounts[0]);
    await keysManager.addMiningKey(miningKey).should.be.fulfilled;
    await keysManager.addVotingKey(votingKey, miningKey).should.be.fulfilled;
    
  })
  describe('#createMetadata', async () => {
    it('happy path', async () => {
      await metadata.setTime(84395);
      await metadata.createMetadata("Djamshut", "Ravshan", "123asd", "Moskva", "ZZ", 234,23423, {from: votingKey}).should.be.fulfilled;
      const validator = await metadata.validators(miningKey);
      validator.should.be.deep.equal([
        toHex("Djamshut"),
        toHex("Ravshan"),
        pad(web3.toHex("123asd")),
        "Moskva",
        toHex("ZZ"),
        new web3.BigNumber(234),
        new web3.BigNumber(23423),
        new web3.BigNumber(84395),
        new web3.BigNumber(0),
        new web3.BigNumber(2)
      ])
    })
  })
  describe('#getMiningByVotingKey', async () => {
    it('happy path', async () => {
      const actual = await metadata.getMiningByVotingKey(votingKey);
      miningKey.should.be.equal(actual);
    })
  })
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