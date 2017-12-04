
let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

contract('ProxyStorage [all features]', function (accounts) {
  describe.skip('#setKeysManager', async () => {
    it('should only be called from VotingContract to set an address', async () => {
        await poaNetworkConsensus.setKeysManager(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        const {logs} = await poaNetworkConsensus.setKeysManager(accounts[1]).should.be.fulfilled;
        logs[0].event.should.be.equal('ChangeReference');
        logs[0].args.nameOfContract.should.be.equal('KeysManager');
        logs[0].args.newAddress.should.be.equal(accounts[1]);
    })
  
    it('should not allow 0x0 addresses', async () => {
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        await poaNetworkConsensus.setKeysManager('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
        await poaNetworkConsensus.setKeysManager('0x0').should.be.rejectedWith(ERROR_MSG);
    })
  
    it('newAddress should not be equal to VotingContract address', async () => {
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        await poaNetworkConsensus.setKeysManager(accounts[0]).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe.skip('#setVotingContract', async () => {
    it('should only be called from VotingContract to set an address', async () => {
        await poaNetworkConsensus.setVotingContract(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        const {logs} = await poaNetworkConsensus.setVotingContract(accounts[1]).should.be.fulfilled;
        logs[0].event.should.be.equal('ChangeReference');
        logs[0].args.nameOfContract.should.be.equal('VotingContract');
        logs[0].args.newAddress.should.be.equal(accounts[1]);
    })

    it('should not allow 0x0 addresses', async () => {
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        await poaNetworkConsensus.setVotingContract('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
        await poaNetworkConsensus.setVotingContract('0x0').should.be.rejectedWith(ERROR_MSG);
    })

    it('newAddress should not be equal to VotingContract address', async () => {
        await poaNetworkConsensus.setVotingContractMock(accounts[0]);
        await poaNetworkConsensus.setKeysManagerMock(accounts[1]);
        await poaNetworkConsensus.setVotingContract(accounts[0]).should.be.rejectedWith(ERROR_MSG);
    })
})

})

