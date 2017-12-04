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
        poaNetworkConsensus = await PoaNetworkConsensus.new(masterOfCeremony);
        proxyStorageMock = await ProxyStorageMock.new(poaNetworkConsensus.address, masterOfCeremony);
        await poaNetworkConsensus.setProxyStorage(proxyStorageMock.address);
        await proxyStorageMock.initializeAddresses(masterOfCeremony, masterOfCeremony, masterOfCeremony);
    });

    describe('default values', async () => {
        it('finalized should be false', async () => {
            let validators = await poaNetworkConsensus.getValidators();
            let finalized = await poaNetworkConsensus.finalized();
            validators.should.be.deep.equal([
                masterOfCeremony
            ]);
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
            await poaNetworkConsensus.finalizeChange().should.be.rejectedWith(ERROR_MSG);
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
            logs[0].event.should.be.equal('ChangeFinalized');
            logs[0].args.newSet.should.be.deep.equal(currentValidators);
        })

        it('set currentValidators to pendingList after addValidator call', async () => {
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.addValidator(accounts[1]);
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
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
            await poaNetworkConsensus.addValidator(accounts[2]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength()
            const expected = [masterOfCeremony, accounts[1], accounts[2]];

            currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            currentValidators = [];
            pendingList = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await poaNetworkConsensus.currentValidators(i);
                currentValidators.push(validator);
                let pending = await poaNetworkConsensus.pendingList(i);
                pendingList.push(pending);
            }
            expected.should.be.deep.equal(pendingList);
            expected.should.be.deep.equal(currentValidators);
        })
    })

    describe('#addValidator', async () => {
        it('should be called only from keys manager', async () => {
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[2]}).should.be.rejectedWith(ERROR_MSG);
            await proxyStorageMock.setKeysManagerMock(accounts[5]);
            await poaNetworkConsensus.addValidator(accounts[1], {from: accounts[5]}).should.be.fulfilled;
        })

        it('should not allow to add already existing validator', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should not allow 0x0 addresses', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator('0x0').should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.addValidator('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
        })

        it('should set validatorsState for new validator', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let state = await poaNetworkConsensus.validatorsState(accounts[1]);
            let currentValidatorsLength = await poaNetworkConsensus.currentValidatorsLength();
            state[0].should.be.true;
            state[1].should.be.bignumber.equal(currentValidatorsLength)
        })

        it('should set finalized to false', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
        })

        it('should emit InitiateChange with blockhash and pendingList as params', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
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
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should be called only from keys manager', async () => {
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should only be allowed to remove from existing set of validators', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should decrease length of pendingList', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.setSystemAddress(accounts[0]);
            await poaNetworkConsensus.finalizeChange().should.be.fulfilled;
            await poaNetworkConsensus.addValidator(accounts[2]).should.be.fulfilled;
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
            const expected = [masterOfCeremony, accounts[2]];
            expected.should.be.deep.equal(pendingList);
        })

        it('should change validatorsState', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const state = await poaNetworkConsensus.validatorsState(accounts[1]);
            state[0].should.be.false;
            state[1].should.be.bignumber.equal(0);
        })

        it('should set finalized to false', async () => {
            await proxyStorageMock.setKeysManagerMock(accounts[0]);
            await poaNetworkConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await poaNetworkConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const finalized = await poaNetworkConsensus.finalized();
            finalized.should.be.false;
        })
    });

    describe('#setProxyStorage', async () => {
        let new_masterOfCeremony = accounts[1];
        it('can only be called from masterOfCeremony', async () => {
            await poaNetworkConsensus.setMoCMock(new_masterOfCeremony);
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await poaNetworkConsensus.setProxyStorage(accounts[5]).should.be.rejectedWith(ERROR_MSG);
            await poaNetworkConsensus.setProxyStorage(accounts[5], {from: new_masterOfCeremony}).should.be.fulfilled;
        })
        it('can only be called once', async () => {
            // we already call it in the beforeEach block, hence why I expect it to be rejected
            await poaNetworkConsensus.setProxyStorage(accounts[5]).should.be.rejectedWith(ERROR_MSG);
        })
        it('cannot be set to 0x0 address', async () => {
            await poaNetworkConsensus.setMoCMock(new_masterOfCeremony);
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await poaNetworkConsensus.setProxyStorage('0x0000000000000000000000000000000000000000', {from: new_masterOfCeremony}).should.be.rejectedWith(ERROR_MSG);
        })
        it('sets proxyStorage', async () => {
            let newProxyStorage = accounts[3];
            await poaNetworkConsensus.setMoCMock(new_masterOfCeremony);
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: new_masterOfCeremony}).should.be.fulfilled;
            (await poaNetworkConsensus.proxyStorage()).should.be.equal(newProxyStorage);
        })
        it('sets isMasterOfCeremonyInitialized', async () => {
            let newProxyStorage = accounts[3];
            await poaNetworkConsensus.setMoCMock(new_masterOfCeremony);
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: new_masterOfCeremony}).should.be.fulfilled;
            (await poaNetworkConsensus.isMasterOfCeremonyInitialized()).should.be.equal(true);
        })

        it('emits MoCInitializedProxyStorage', async () => {
            let newProxyStorage = accounts[3];
            await poaNetworkConsensus.setMoCMock(new_masterOfCeremony);
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            const {logs} = await poaNetworkConsensus.setProxyStorage(newProxyStorage, {from: new_masterOfCeremony}).should.be.fulfilled;
            logs[0].event.should.be.equal('MoCInitializedProxyStorage');
            logs[0].args.proxyStorage.should.be.equal(newProxyStorage);
        })
        it('#getKeysManagerAddress', async () => {
            let newKeysManager = accounts[3];
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await proxyStorageMock.setKeysManagerMock(newKeysManager);
            (await poaNetworkConsensus.getKeysManagerAddress()).should.be.equal(newKeysManager);
        })
        it('#getVotingToChangeKeys', async () => {
            let newVotingToChangeKeys = accounts[3];
            await poaNetworkConsensus.setIsMasterOfCeremonyInitializedMock(false);
            await proxyStorageMock.setVotingContractMock(newVotingToChangeKeys);
            (await poaNetworkConsensus.getVotingToChangeKeys()).should.be.equal(newVotingToChangeKeys);
        })
    })
    describe('#isValidator', async () => {
        it('returns address of miner', async () => {
            (await poaNetworkConsensus.isValidator(masterOfCeremony)).should.be.equal(true);
            (await poaNetworkConsensus.isValidator(accounts[2])).should.be.equal(false);
        })
    })
});