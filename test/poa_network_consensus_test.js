let PoaNetworkConsensus = artifacts.require('./mockContracts/PoaNetworkConsensusMock');
let ProxyStorageMock = artifacts.require('./mockContracts/ProxyStorageMock');
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
        poaNetworkConsensus = await PoaNetworkConsensus.new();
        await poaNetworkConsensus.setMoCMock(masterOfCeremony);
        proxyStorageMock = await ProxyStorageMock.new(poaNetworkConsensus.address, masterOfCeremony);
        await poaNetworkConsensus.setProxyStorage(proxyStorageMock.address);
        await proxyStorageMock.initializeAddresses(masterOfCeremony, masterOfCeremony, masterOfCeremony);
    });

    describe('default values', async () => {
        it('finalized should be false', async () => {
            let validators = await poaNetworkConsensus.getValidators();
            let finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
        });

        it('checks systemAddress', async () => {
            let systemAddress = await poaNetworkConsensus.systemAddress();
            systemAddress.should.be.equal('0xfffffffffffffffffffffffffffffffffffffffe');
        })
    })

    describe('#finalizeChange', async () => {
        it('should only be called by systemAddress', async () => {
            await poaNetworkConsensus.finalizeChange().should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
        })

        it('should set finalized to true', async () => {
            let finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.true;

        })

        it('should set currentValidators to pendingList', async () => {
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            const { logs } = await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            let currentValidators = [];
            let pendingList = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await poaNetworkConsensus.currentValidators(i);
                currentValidators.push(validator);
                let pending = await poaNetworkConsensus.pendingList(i);
                pendingList.push(pending);
            }
            currentValidators.should.be.deep.equal(pendingList);
            const event = logs.find(e => e.event === 'ChangeFinalized')
            event.should.exist
        })

        it('set currentValidators to pendingList after addValidator call', async () => {
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.addValidator(accounts[1]);
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            const { logs } = await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            let currentValidators = [];
            let pendingList = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await poaNetworkConsensus.currentValidators(i);
                currentValidators.push(validator);
                let pending = await poaNetworkConsensus.pendingList(i);
                pendingList.push(pending);
            }
            currentValidators.should.be.deep.equal(pendingList);
        })
    })

    describe.only('#addValidator', async () => {
        it('should add validator', async () => {
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
        })

        it('should be called only either from ballot manager or keys manager', async () => {
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.setVotingContractMock(accounts[5]);
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[5]}).should.be.fulfilled;
            await poaNetworkConsensus.setKeysManagerMock(accounts[6]);
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[5]}).should.be.fulfilled;
        })

        it('should not allow to add already existing validator', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should not allow 0x0 addresses', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator('0x0').should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.addValidator('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
        })

        it('should set validatorsState for new validator', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let state = await poaNetworkConsensus.validatorsState(accounts[1]);
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            state[0].should.be.true;
            state[1].should.be.bignumber.equal(currentValidatorsLength)
        })

        it('should set finalized to false', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
        })

        it('should emit InitiateChange with blockhash and pendingList as params', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            const {logs} = await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            let currentValidators = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await poaNetworkConsensus.currentValidators(i);
                currentValidators.push(validator);
            }
            currentValidators.push(accounts[1]);
            logs[0].args['newSet'].should.deep.equal(currentValidators);  
            logs[0].event.should.be.equal('InitiateChange');
        })
    })

    describe('#removeValidator', async () => {
        it('should remove validator', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should be called only either from ballot manager or keys manager', async () => {
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.setVotingContractMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should only be allowed to remove from existing set of validators', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should decrease length of pendingList', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            await poaNetworkConsensus.addValidator(accounts[2]).should.be.fulfilled;
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            let pendingList = [];
            for(let i = 0; i < currentValidatorsLength; i++){
                let pending = await poaNetworkConsensus.pendingList(i);
                pendingList.push(pending);
            }
            const indexOfRemovedElement = pendingList.indexOf(accounts[1]);
            pendingList.splice(indexOfRemovedElement, 1);
            const { logs } = await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            let pendingListFromContract = logs[0].args['newSet'];
            pendingListFromContract.length.should.be.equal(currentValidatorsLength.toNumber(10) - 1);
            pendingList.should.be.deep.equal(pendingListFromContract);
            logs[0].event.should.be.equal('InitiateChange');
        })

        it('should change validatorsState', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const state = await poaNetworkConsensus.validatorsState(accounts[1]);
            state[0].should.be.false;
            state[1].should.be.bignumber.equal(0);
        })

        it('should set finalized to false', async () => {
            await poaNetworkConsensus.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
        })

    })

    describe('#setKeysManager', async () => {
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

    describe('#setVotingContract', async () => {
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

});