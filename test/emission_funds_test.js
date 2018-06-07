let EmissionFunds = artifacts.require('./EmissionFunds');

const ERROR_MSG = 'VM Exception while processing transaction: revert';

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('EmissionFunds [all features]', function (accounts) {
  let emissionFunds, amount;
  let votingToManageEmissionFunds;
  
  beforeEach(async () => {
    amount = web3.toWei(10, 'ether');
    votingToManageEmissionFunds = accounts[0];

    await EmissionFunds.new(0).should.be.rejectedWith(ERROR_MSG);
    
    emissionFunds = await EmissionFunds.new(
      votingToManageEmissionFunds
    ).should.be.fulfilled;
    
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: emissionFunds.address,
      value: amount
    });

    amount.should.be.bignumber.equal(
      await web3.eth.getBalance(emissionFunds.address)
    );
  });

  /*
  describe('constructor', async () => {
    it('should save VotingToManageEmissionFunds address', async () => {
      (await emissionFunds.votingToManageEmissionFunds.call()).should.be.equal(
        votingToManageEmissionFunds
      );
    });
  });

  describe('#fallback', async () => {
    it('should receive funds', async () => {
      await web3.eth.sendTransaction({
        from: accounts[1],
        to: emissionFunds.address,
        value: amount
      });
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(
        amount * 2
      );
    });
  });
  */

  describe('#sendFundsTo', async () => {
    let receiver, receiverInitBalance;

    beforeEach(async () => {
      receiver = accounts[2];
      receiverInitBalance = await web3.eth.getBalance(receiver);
    });

    /*
    it('may be called only by VotingToManageEmissionFunds', async () => {
      const amountToSend = web3.toWei(5, 'ether');
      await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: accounts[3]}
      ).should.be.rejectedWith(ERROR_MSG);
      await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
    });

    it('should send funds to receiver', async () => {
      const amountToSend = web3.toWei(4, 'ether');
      const amountRemain = amount - amountToSend;

      const {logs} = await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
      
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(
        amountRemain
      );
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(amountToSend)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal(receiver);
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToSend);
      logs[0].args.success.should.be.equal(true);
    });

    it('should send entire amount', async () => {
      const {logs} = await emissionFunds.sendFundsTo(
        receiver,
        amount,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
      
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      (await web3.eth.getBalance(receiver)).should.be.bignumber.equal(
        receiverInitBalance.add(amount)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal(receiver);
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amount);
      logs[0].args.success.should.be.equal(true);
    });

    it('should not send funds if amount greater than balance', async () => {
      const amountToSend = amount + 1;

      const {logs} = await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );
      receiverInitBalance.should.be.bignumber.equal(
        await web3.eth.getBalance(receiver)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal(receiver);
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToSend);
      logs[0].args.success.should.be.equal(false);
    });

    it('should not send funds if amount is too much', async () => {
      const amountToSend = web3.toWei(11, 'ether');

      const {logs} = await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );
      receiverInitBalance.should.be.bignumber.equal(
        await web3.eth.getBalance(receiver)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal(receiver);
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToSend);
      logs[0].args.success.should.be.equal(false);
    });

    it('should be fulfilled if receiver is 0x0', async () => {
      const amountToSend = web3.toWei(5, 'ether');
      const amountRemain = amount - amountToSend;

      const {logs} = await emissionFunds.sendFundsTo(
        '0x0000000000000000000000000000000000000000',
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amountRemain.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal('0x0000000000000000000000000000000000000000');
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToSend);
      logs[0].args.success.should.be.equal(true);
    });

    it('should be fulfilled if amount is zero', async () => {
      const amountToSend = 0;

      const {logs} = await emissionFunds.sendFundsTo(
        receiver,
        amountToSend,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );
      receiverInitBalance.should.be.bignumber.equal(
        await web3.eth.getBalance(receiver)
      );

      logs[0].event.should.be.equal("FundsSentTo");
      logs[0].args.receiver.should.be.equal(receiver);
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(0);
      logs[0].args.success.should.be.equal(true);
    });
    */

    it('should fail if receiver address is not full', async () => {
      const signature = web3.sha3('sendFundsTo(address,uint256)').slice(0, 10);
      let data = signature;
      data += '0000000000000000000000000000000000000000000000000000000000000A';
      data += '0000000000000000000000000000000000000000000000004563918244F40000';
      let receipt = await web3.eth.getTransactionReceipt(
        await web3.eth.sendTransaction({
          from: votingToManageEmissionFunds,
          to: emissionFunds.address,
          data: data
        })
      );
      receipt.logs.length.should.be.equal(0);
      data = signature;
      data += '000000000000000000000000000000000000000000000000000000000000000A';
      data += '0000000000000000000000000000000000000000000000004563918244F40000';
      receipt = await web3.eth.getTransactionReceipt(
        await web3.eth.sendTransaction({
          from: votingToManageEmissionFunds,
          to: emissionFunds.address,
          data: data
        })
      );
      receipt.logs.length.should.be.equal(1);
    });
  });

  /*
  describe('#burnFunds', async () => {
    it('may be called only by VotingToManageEmissionFunds', async () => {
      const amountToBurn = web3.toWei(5, 'ether');
      await emissionFunds.burnFunds(
        amountToBurn,
        {from: accounts[3]}
      ).should.be.rejectedWith(ERROR_MSG);
      await emissionFunds.burnFunds(
        amountToBurn,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
    });

    it('should burn funds', async () => {
      const amountToBurn = web3.toWei(4, 'ether');
      const amountRemain = amount - amountToBurn;

      const {logs} = await emissionFunds.burnFunds(
        amountToBurn,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
      
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(
        amountRemain
      );

      logs[0].event.should.be.equal("FundsBurnt");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToBurn);
      logs[0].args.success.should.be.equal(true);
    });

    it('should burn entire amount', async () => {
      const {logs} = await emissionFunds.burnFunds(
        amount,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
      
      (await web3.eth.getBalance(emissionFunds.address)).should.be.bignumber.equal(0);
      
      logs[0].event.should.be.equal("FundsBurnt");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amount);
      logs[0].args.success.should.be.equal(true);
    });

    it('should not burn funds if amount greater than balance', async () => {
      const amountToBurn = amount + 1;

      const {logs} = await emissionFunds.burnFunds(
        amountToBurn,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsBurnt");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToBurn);
      logs[0].args.success.should.be.equal(false);
    });

    it('should not burn funds if amount is too much', async () => {
      const amountToBurn = web3.toWei(11, 'ether');

      const {logs} = await emissionFunds.burnFunds(
        amountToBurn,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsBurnt");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToBurn);
      logs[0].args.success.should.be.equal(false);
    });

    it('should be fulfilled if amount is zero', async () => {
      const amountToBurn = 0;

      const {logs} = await emissionFunds.burnFunds(
        amountToBurn,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsBurnt");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(0);
      logs[0].args.success.should.be.equal(true);
    });
  });

  describe('#freezeFunds', async () => {
    it('may be called only by VotingToManageEmissionFunds', async () => {
      const amountToFreeze = web3.toWei(5, 'ether');
      await emissionFunds.freezeFunds(
        amountToFreeze,
        {from: accounts[3]}
      ).should.be.rejectedWith(ERROR_MSG);
      await emissionFunds.freezeFunds(
        amountToFreeze,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
    });

    it('should freeze funds', async () => {
      const amountToFreeze = web3.toWei(4, 'ether');

      const {logs} = await emissionFunds.freezeFunds(
        amountToFreeze,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;
      
      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsFrozen");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(amountToFreeze);
    });

    it('should be fulfilled if amount is zero', async () => {
      const amountToFreeze = 0;

      const {logs} = await emissionFunds.freezeFunds(
        amountToFreeze,
        {from: votingToManageEmissionFunds}
      ).should.be.fulfilled;

      amount.should.be.bignumber.equal(
        await web3.eth.getBalance(emissionFunds.address)
      );

      logs[0].event.should.be.equal("FundsFrozen");
      logs[0].args.caller.should.be.equal(votingToManageEmissionFunds);
      logs[0].args.amount.should.be.bignumber.equal(0);
    });
  });
  */
});