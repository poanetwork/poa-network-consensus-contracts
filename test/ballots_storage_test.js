let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
let BallotsStorageMock = artifacts.require('./mockContracts/BallotsStorageMock');
let VotingToChangeMinThresholdMock = artifacts.require('./mockContracts/VotingToChangeMinThresholdMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

let proxyStorage, masterOfCeremony, ballotsStorage;
contract('BallotsStorage [all features]', function (accounts) {
  let {keysManager, votingToChangeKeys, votingToChangeMinThreshold, votingToChangeProxy, ballotsStorage} = {
    keysManager: accounts[1],
    votingToChangeKeys: accounts[2],
    votingToChangeMinThreshold: accounts[3],
    votingToChangeProxy: accounts[4],
    ballotsStorage: accounts[5]
  }
  masterOfCeremony = accounts[0];
  beforeEach(async () => {
    poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony);
    proxyStorage = await ProxyStorageMock.new(poaNetworkConsensus.address, masterOfCeremony);
    ballotsStorageMock = await BallotsStorageMock.new(proxyStorage.address);
    //votingToChangeMinThresholdMock = await VotingToChangeMinThresholdMock.new(proxyStorage.address);
    await proxyStorage.initializeAddresses(keysManager, votingToChangeKeys, votingToChangeMinThreshold, votingToChangeProxy, ballotsStorage);
  })
  describe('#contstuctor', async () => {
    it('sets MoC and Poa', async () => {
      new web3.BigNumber(3).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold(1)
      );
      new web3.BigNumber(2).should.be.bignumber.equal(
        await ballotsStorage.getBallotThreshold(2)
      );
    })
  })
  describe('#setThreshold', async () => {
    it('can only be called from votingToChangeThreshold address', async () => {
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
    })
    it('cannot be set for Invalid threshold', async () => {
      await ballotsStorageMock.setThreshold(5, 0, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, -10, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, -1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(5, 3, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('new value cannot be equal to 0', async () => {
      await ballotsStorageMock.setThreshold(0, 1, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(0, 2, {from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await ballotsStorageMock.setThreshold(4, 1, {from: accounts[3]}).should.be.fulfilled;
      await ballotsStorageMock.setThreshold(4, 2, {from: accounts[3]}).should.be.fulfilled;
    })
    it('sets new value for Keys threshold', async () => {
      await ballotsStorageMock.setThreshold(5, 1, {from: accounts[3]}).should.be.fulfilled; 
      new web3.BigNumber(5).should.be.bignumber.equal(await ballotsStorageMock.getBallotThreshold(1));
    })
    it('sets new value for MetadataChange threshold', async () => {
      await ballotsStorageMock.setThreshold(6, 2, {from: accounts[3]}).should.be.fulfilled;
      new web3.BigNumber(6).should.be.bignumber.equal(await ballotsStorageMock.getBallotThreshold(2));
    })
  })  
})

