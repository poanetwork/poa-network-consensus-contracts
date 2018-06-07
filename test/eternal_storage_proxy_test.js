const EternalStorageProxy = artifacts.require('./EternalStorageProxy');
const ERROR_MSG = 'VM Exception while processing transaction: revert';

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('EternalStorageProxy [all features]', function (accounts) {
  describe('constructor', async () => {
    it('should revert if implementation address is equal to 0x0', async () => {
      await EternalStorageProxy.new(
        accounts[1],
        '0x0000000000000000000000000000000000000000'
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('should allow ProxyStorage address equal to 0x0', async () => {
      const instance = await EternalStorageProxy.new(
        '0x0000000000000000000000000000000000000000',
        accounts[1]
      ).should.be.fulfilled;

      instance.address.should.be.equal(
        await instance.getProxyStorage.call()
      );
    });
    it('should set ProxyStorage address', async () => {
      const instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
      (await instance.getProxyStorage.call()).should.be.equal(accounts[1]);
    });
    it('should set implementation address', async () => {
      const instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
      (await instance.implementation.call()).should.be.equal(accounts[2]);
    });
    it('should set owner', async () => {
      const instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
      (await instance.getOwner.call()).should.be.equal(accounts[0]);
    });
  });

  describe('#fallback function', async () => {
    // Please, see the tests of other contracts
  });

  describe('#renounceOwnership', async () => {
    let instance;
    beforeEach(async () => {
      instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
    });
    it('may only be called by an owner', async () => {
      await instance.renounceOwnership({from: accounts[3]}).should.be.rejectedWith(ERROR_MSG);
      await instance.renounceOwnership().should.be.fulfilled;
    });
    it('should set owner to 0x0', async () => {
      const {logs} = await instance.renounceOwnership().should.be.fulfilled;
      (await instance.getOwner.call()).should.be.equal(
        '0x0000000000000000000000000000000000000000'
      );
      logs[0].event.should.be.equal("OwnershipRenounced");
      logs[0].args.previousOwner.should.be.equal(accounts[0]);
    });
  });

  describe('#transferOwnership', async () => {
    let instance;
    beforeEach(async () => {
      instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
    });
    it('may only be called by an owner', async () => {
      await instance.transferOwnership(
        accounts[3],
        {from: accounts[4]}
      ).should.be.rejectedWith(ERROR_MSG);
      await instance.transferOwnership(accounts[3]).should.be.fulfilled;
    });
    it('should change owner', async () => {
      const {logs} = await instance.transferOwnership(accounts[3]).should.be.fulfilled;
      (await instance.getOwner.call()).should.be.equal(accounts[3]);
      logs[0].event.should.be.equal("OwnershipTransferred");
      logs[0].args.previousOwner.should.be.equal(accounts[0]);
      logs[0].args.newOwner.should.be.equal(accounts[3]);
    });
    it('should not change owner if its address is 0x0', async () => {
      await instance.transferOwnership(
        '0x0000000000000000000000000000000000000000'
      ).should.be.rejectedWith(ERROR_MSG);
    });
  });

  describe('#upgradeTo', async () => {
    let instance;
    beforeEach(async () => {
      instance = await EternalStorageProxy.new(
        accounts[1],
        accounts[2]
      ).should.be.fulfilled;
    });
    it('may only be called by ProxyStorage', async () => {
      await instance.upgradeTo(accounts[3]).should.be.rejectedWith(ERROR_MSG);
      await instance.upgradeTo(accounts[3], {from: accounts[1]}).should.be.fulfilled;
    });
    it('should not change implementation address if it is the same', async () => {
      await instance.upgradeTo(
        accounts[2],
        {from: accounts[1]}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('should not change implementation address if it is 0x0', async () => {
      await instance.upgradeTo(
        '0x0000000000000000000000000000000000000000',
        {from: accounts[1]}
      ).should.be.rejectedWith(ERROR_MSG);
    });
    it('should change implementation address', async () => {
      const {logs} = await instance.upgradeTo(
        accounts[3],
        {from: accounts[1]}
      ).should.be.fulfilled;
      (await instance.implementation.call()).should.be.equal(accounts[3]);
      logs[0].event.should.be.equal("Upgraded");
      logs[0].args.version.should.be.bignumber.equal(1);
      logs[0].args.implementation.should.be.equal(accounts[3]);
    });
    it('should increment version', async () => {
      (await instance.version.call()).should.be.bignumber.equal(0);
      await instance.upgradeTo(
        accounts[3],
        {from: accounts[1]}
      ).should.be.fulfilled;
      (await instance.version.call()).should.be.bignumber.equal(1);
    });
  });
});
