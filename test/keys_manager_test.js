let PoaNetworkConsensusMock = artifacts.require('./PoaNetworkConsensusMock');
let KeysManagerMock = artifacts.require('./KeysManagerMock');
const ERROR_MSG = 'VM Exception while processing transaction: revert';
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('KeysManager [all features]', function (accounts) {
  let keysManager;

  beforeEach(async () => {
    poaNetworkConsensusMock = await PoaNetworkConsensusMock.new(accounts[0]);
    console.log("poaNetworkConsensusMock address:", poaNetworkConsensusMock.address)
    keysManager = await KeysManagerMock.new(accounts[0]);
  });

  describe('#constructor', async () => {
    it('sets owner to the master of ceremony', async () => {
      accounts[0].should.be.equal(await keysManager.owner());
    })
  });

  describe('#initiateKeys', async () => {
    it('can only be called by master of ceremony', async() => {
      await keysManager.initiateKeys(accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys(accounts[2], {from: accounts[0]}).should.be.fulfilled;
    })

    it('cannot allow 0x0 addresses', async () => {
      await keysManager.initiateKeys('0x0000000000000000000000000000000000000000').should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys('0x0').should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow to initialize already initialized key', async () => {
      await keysManager.initiateKeys(accounts[2], {from: accounts[0]}).should.be.fulfilled;   
      await keysManager.initiateKeys(accounts[2], {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not equal to master of ceremony', async () => {
      await keysManager.initiateKeys(accounts[0], {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow to initialize more than maxNumberOfInitialKeys', async () => {
      await keysManager.setMaxNumberOfInitialKeys(2);
      let maxNumberOfInitialKeys = await keysManager.maxNumberOfInitialKeys();
      maxNumberOfInitialKeys.should.be.bignumber.equal(2);
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[2], {from: accounts[0]}).should.be.fulfilled;
      await keysManager.initiateKeys(accounts[3], {from: accounts[0]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should increment initialKeyCount by 1', async () => {
      let initialKeysCount = await keysManager.initialKeysCount();
      initialKeysCount.should.be.bignumber.equal(0);
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      initialKeysCount = await keysManager.initialKeysCount();
      initialKeysCount.should.be.bignumber.equal(1);
    })

    it('should set initialKeys hash to true', async() => {
      false.should.be.equal(await keysManager.initialKeys(accounts[1]));
      const {logs} = await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      true.should.be.equal(await keysManager.initialKeys(accounts[1]));
      let initialKeysCount = await keysManager.initialKeysCount();
      // event InitialKeyCreated(address indexed initialKey, uint256 time, uint256 initialKeysCount);
      logs[0].event.should.equal("InitialKeyCreated");
      logs[0].args.initialKey.should.be.equal(accounts[1]);
      initialKeysCount.should.be.bignumber.equal(logs[0].args.initialKeysCount);
    })
  });
  describe.only('#createKeys', async () => {
    it('should only be called from initialized key', async () => {
      await keysManager.createKeys(accounts[2], accounts[3], accounts[4], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      await keysManager.createKeys(accounts[2], accounts[3], accounts[4], {from: accounts[1]}).should.be.fulfilled;
    });
    it('params should not be equal to each other', async () => {
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      await keysManager.createKeys(accounts[0], accounts[0], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[0], accounts[2], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[0], accounts[2], accounts[0], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    });
    it('any of params should not be equal to initialKey', async () => {
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      await keysManager.createKeys(accounts[1], accounts[0], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[0], accounts[1], accounts[2], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
      await keysManager.createKeys(accounts[0], accounts[2], accounts[1], {from: accounts[1]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should assign mining, voting, payout keys to relative mappings', async () => {
      await keysManager.initiateKeys(accounts[1], {from: accounts[0]}).should.be.fulfilled;
      const {logs} = await keysManager.createKeys(accounts[0], accounts[3], accounts[2], {from: accounts[1]}).should.be.fulfilled;
      true.should.be.equal(
        await keysManager.isMiningActive(accounts[0])
      )
      true.should.be.equal(
        await keysManager.isVotingActive(accounts[3])
      )
      true.should.be.equal(
        await keysManager.isPayoutActive(accounts[0])
      )
      // event ValidatorInitialized(address indexed miningKey, address indexed votingKey, address indexed payoutKey);
      logs[0].event.should.be.equal('ValidatorInitialized');
      logs[0].args.miningKey.should.be.equal(accounts[0]);
      logs[0].args.votingKey.should.be.equal(accounts[3]);
      logs[0].args.payoutKey.should.be.equal(accounts[2]);
    })
  })
});