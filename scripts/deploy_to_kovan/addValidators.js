const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');
const keythereum = require('keythereum');

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

main();

async function main() {
	let privateKey = process.env.PRIVATE_KEY;
	if (!privateKey) privateKey = await utils.readPrivateKey();
	addAndCheck(privateKey);
}

async function addAndCheck(privateKey) {
	let key, sender, chainId;

	key = Buffer.from(privateKey, 'hex');
	sender = '0x' + EthereumUtil.privateToAddress(key).toString('hex');
	chainId = web3.utils.toHex(await web3.eth.net.getId());

	try {
		console.log('Add validators...');

		const contractNewAddress = process.env.KEYS_MANAGER_NEW_ADDRESS;
		const keysManagerNewInstance = new web3.eth.Contract(JSON.parse(process.env.KEYS_MANAGER_NEW_ABI), contractNewAddress);

		let initialKeys = [];
		let initialKeysAddresses = [];
		for (let i = 0; i < constants.VALIDATOR.length; i++) {
			console.log(`  Add validator ${constants.VALIDATOR[i].mining}...`);

			const dk = keythereum.create();
			const keyObject = keythereum.dump('123', dk.privateKey, dk.salt, dk.iv);
			initialKeys.push(dk.privateKey);
			initialKeysAddresses.push(`0x${keyObject.address}`);

			console.log(`    InitialKey: 0x${keyObject.address}`);

			const initiateKeys = keysManagerNewInstance.methods.initiateKeys(initialKeysAddresses[i]);
			await utils.call(initiateKeys, sender, contractNewAddress, key, chainId);
			console.log(`    initiateKeys() called successfully`);

			await utils.send(sender, initialKeysAddresses[i], key, chainId);
			console.log(`    300000 gwei were sent from ${sender} to ${initialKeysAddresses[i]}`);

			const createKeys = keysManagerNewInstance.methods.createKeys(
				constants.VALIDATOR[i].mining,
				constants.VALIDATOR[i].voting,
				constants.VALIDATOR[i].payout
			);
			await utils.call(createKeys, initialKeysAddresses[i], contractNewAddress, initialKeys[i], chainId);
			console.log(`    createKeys() called successfully`);
		}
		
		console.log('  Checking KeysManager contract...');
		for (let i = 0; i < initialKeysAddresses.length; i++) {
			(await keysManagerNewInstance.methods.getInitialKeyStatus(initialKeysAddresses[i]).call()).should.be.bignumber.equal(2);
		}
		for (let i = 0; i < constants.VALIDATOR.length; i++) {
			const miningKey = constants.VALIDATOR[i].mining;
			const votingKey = constants.VALIDATOR[i].voting;
			const payoutKey = constants.VALIDATOR[i].payout;
			console.log(`  Check validator ${miningKey}...`);
			
			try {
				const validatorNewKeys = await keysManagerNewInstance.methods.validatorKeys(miningKey).call();
				validatorNewKeys[0].toLowerCase().should.be.equal(votingKey.toLowerCase()); // validatorVotingKey
				validatorNewKeys[1].toLowerCase().should.be.equal(payoutKey.toLowerCase()); // validatorPayoutKey
				validatorNewKeys[2].should.be.equal(true); // isValidatorMiningActive
				validatorNewKeys[3].should.be.equal(true); // isValidatorVotingActive
				validatorNewKeys[4].should.be.equal(true); // isValidatorPayoutActive
				(await keysManagerNewInstance.methods.miningKeyByPayout(payoutKey).call()).toLowerCase().should.be.equal(
					miningKey.toLowerCase()
				);
				(await keysManagerNewInstance.methods.miningKeyByVoting(votingKey).call()).toLowerCase().should.be.equal(
					miningKey.toLowerCase()
				);
				payoutKey.toLowerCase().should.be.equal(
					(await keysManagerNewInstance.methods.getPayoutByMining(miningKey).call()).toLowerCase()
				);
				votingKey.toLowerCase().should.be.equal(
					(await keysManagerNewInstance.methods.getVotingByMining(miningKey).call()).toLowerCase()
				);
			} catch (check_err) {
				if (check_err.message.indexOf('Invalid JSON RPC response') >= 0) {
					i--;
					continue;
				} else {
					throw check_err;
				}
			}
		}
		
		console.log('Success');
		console.log('');
	} catch (err) {
		console.log('Cannot add validators:');
		console.log(err);
		process.exit(1);
	}
}
