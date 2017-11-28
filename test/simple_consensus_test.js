let SimpleConsensus = artifacts.require('./SimpleConsensusMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

contract('SimpleConsensus [all features]', function (accounts) {
    let simpleConsensus;

    beforeEach(async () => {
        simpleConsensus = await SimpleConsensus.new();
    });

    describe('default values', async () => {
        it('finalized should be false', async () => {
            let validators = await simpleConsensus.getValidators();
            let finalized = await simpleConsensus.finalized();
            finalized.should.be.false;
        });

        it('checks systemAddress', async () => {
            let systemAddress = await simpleConsensus.systemAddress();
            systemAddress.should.be.equal('0xfffffffffffffffffffffffffffffffffffffffe');
        })
    })

    describe('#finalizeChange', async () => {
        it('should only be called by systemAddress', async () => {
            await simpleConsensus.finalizeChange().should.be.rejectedWith(ERROR_MSG);
            await simpleConsensus.setSystemAddress(accounts[0]);
            await simpleConsensus.finalizeChange().should.be.fulfilled;
        })

        it('should set finalized to true', async () => {
            let finalized = await simpleConsensus.finalized();
            finalized.should.be.false;
            await simpleConsensus.setSystemAddress(accounts[0]);
            await simpleConsensus.finalizeChange().should.be.fulfilled;
            finalized = await simpleConsensus.finalized();
            finalized.should.be.true;

        })

        it('should set currentValidators to pendingList', async () => {
            await simpleConsensus.setSystemAddress(accounts[0]);
            const { logs } = await simpleConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await simpleConsensus.currentValidatorsLength();
            let currentValidators = [];
            let pendingList = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await simpleConsensus.currentValidators(i);
                currentValidators.push(validator);
                let pending = await simpleConsensus.pendingList(i);
                pendingList.push(pending);
            }
            currentValidators.should.be.deep.equal(pendingList);
            const event = logs.find(e => e.event === 'ChangeFinalized')
            event.should.exist
        })

        it('set currentValidators to pendingList after addValidator call', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]);
            await simpleConsensus.setSystemAddress(accounts[0]);
            const { logs } = await simpleConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await simpleConsensus.currentValidatorsLength();
            let currentValidators = [];
            let pendingList = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await simpleConsensus.currentValidators(i);
                currentValidators.push(validator);
                let pending = await simpleConsensus.pendingList(i);
                pendingList.push(pending);
            }
            currentValidators.should.be.deep.equal(pendingList);
        })
    })

    describe('#addValidator', async () => {
        it('should add validator', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
        })

        it('should be called only either from ballot manager or keys manager', async () => {
            await simpleConsensus.addValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.setBallotsManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[2]).should.be.fulfilled;
        })

        it('should not allow to add already existing validator', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.addValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should not allow 0x0 addresses', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator('0x0').should.be.rejectedWith(ERROR_MSG);
            await simpleConsensus.addValidator('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
        })

        it('should set validatorsState for new validator', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let state = await simpleConsensus.validatorsState(accounts[1]);
            let currentValidatorsLength = await simpleConsensus.currentValidatorsLength();
            state[0].should.be.true;
            state[1].should.be.bignumber.equal(currentValidatorsLength)
        })

        it('should set finalized to false', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let finalized = await simpleConsensus.finalized();
            finalized.should.be.false;
        })

        it('should emit InitiateChange with blockhash and pendingList as params', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            const {logs} = await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            let currentValidatorsLength = await simpleConsensus.currentValidatorsLength();
            let currentValidators = [];
            for (let i = 0; i < currentValidatorsLength.toNumber(10); i++) {
                let validator = await simpleConsensus.currentValidators(i);
                currentValidators.push(validator);
            }
            currentValidators.push(accounts[1]);
            logs[0].args['newSet'].should.deep.equal(currentValidators);  
            logs[0].event.should.be.equal('InitiateChange');
        })
    })

    describe('#removeValidator', async () => {
        it('should remove validator', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should be called only either from ballot manager or keys manager', async () => {
            await simpleConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.setBallotsManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
        })

        it('should only be allowed to remove from existing set of validators', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.removeValidator(accounts[1]).should.be.rejectedWith(ERROR_MSG);
        })

        it('should decrease length of pendingList', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.setSystemAddress(accounts[0]);
            await simpleConsensus.finalizeChange().should.be.fulfilled;
            await simpleConsensus.addValidator(accounts[2]).should.be.fulfilled;
            await simpleConsensus.setSystemAddress(accounts[0]);
            await simpleConsensus.finalizeChange().should.be.fulfilled;
            let currentValidatorsLength = await simpleConsensus.currentValidatorsLength();
            let pendingList = [];
            for(let i = 0; i < currentValidatorsLength; i++){
                let pending = await simpleConsensus.pendingList(i);
                pendingList.push(pending);
            }
            const indexOfRemovedElement = pendingList.indexOf(accounts[1]);
            pendingList.splice(indexOfRemovedElement, 1);
            const { logs } = await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            let pendingListFromContract = logs[0].args['newSet'];
            pendingListFromContract.length.should.be.equal(currentValidatorsLength.toNumber(10) - 1);
            pendingList.should.be.deep.equal(pendingListFromContract);
            logs[0].event.should.be.equal('InitiateChange');
        })

        it('should change validatorsState', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const state = await simpleConsensus.validatorsState(accounts[1]);
            state[0].should.be.false;
            state[1].should.be.bignumber.equal(0);
        })

        it('should set finalized to false', async () => {
            await simpleConsensus.setKeysManager(accounts[0]);
            await simpleConsensus.addValidator(accounts[1]).should.be.fulfilled;
            await simpleConsensus.removeValidator(accounts[1]).should.be.fulfilled;
            const finalized = await simpleConsensus.finalized();
            finalized.should.be.false;
        })

    })

});