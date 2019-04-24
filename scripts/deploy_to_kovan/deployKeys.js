const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');
const keythereum = require('keythereum');

const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const POA_CONSENSUS_NEW_ADDRESS = process.env.POA_CONSENSUS_NEW_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

main();

async function main() {
	let privateKey = process.env.PRIVATE_KEY;
	if (!privateKey) privateKey = await utils.readPrivateKey();
	deployAndCheck(privateKey);
}

async function deployAndCheck(privateKey) {
	let key, sender, chainId;

	key = Buffer.from(privateKey, 'hex');
	sender = '0x' + EthereumUtil.privateToAddress(key).toString('hex');
	chainId = web3.utils.toHex(await web3.eth.net.getId());

	try {
		console.log('KeysManager deploy...');

		const implCompiled = await utils.compile('../../contracts/', 'KeysManager');
		const implAddress = await utils.deploy('KeysManager', implCompiled, sender, key, chainId);
		console.log(`  KeysManager implementation address is ${implAddress}`);
		const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
		let contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		if (process.send) {
			process.send({
				keysManagerNewAddress: contractNewAddress,
				keysManagerNewAbi: implCompiled.abi
			});
		}
		console.log(`  KeysManager storage address is ${contractNewAddress}`);

		const keysManagerNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		console.log('  Call init method...');
		const init = keysManagerNewInstance.methods.init(
			'0x0000000000000000000000000000000000000000'
		);
		await utils.call(init, sender, contractNewAddress, key, chainId);

		(await keysManagerNewInstance.methods.maxOldMiningKeysDeepCheck().call()).should.be.bignumber.equal(25);
		(await keysManagerNewInstance.methods.maxNumberOfInitialKeys().call()).should.be.bignumber.equal(constants.VALIDATOR.length);

		let initialKeys = [];
		let initialKeysAddresses = [];
		for (let i = 0; i < constants.VALIDATOR.length; i++) {
			console.log(`  Add validator ${constants.VALIDATOR[i].mining}...`);

			const dk = keythereum.create();
			const keyObject = keythereum.dump('123', dk.privateKey, dk.salt, dk.iv);
			initialKeys.push(dk.privateKey);
			initialKeysAddresses.push(`0x${keyObject.address}`);

			console.log(`    InitiateKey: 0x${keyObject.address}`);

			const initiateKeys = keysManagerNewInstance.methods.initiateKeys(initialKeysAddresses[i]);
			await utils.call(initiateKeys, sender, contractNewAddress, key, chainId);
			console.log(`    initiateKeys() called successfully`);

			const createKeys = keysManagerNewInstance.methods.createKeys(
				constants.VALIDATOR[i].mining,
				constants.VALIDATOR[i].voting,
				constants.VALIDATOR[i].payout
			);
			await utils.call(createKeys, initialKeysAddresses[i], contractNewAddress, initialKeys[i], chainId);
			console.log(`    createKeys() called successfully`);
		}
		
		console.log('  Checking new contract...');
		true.should.be.equal(
			await keysManagerNewInstance.methods.initDisabled().call()
		);
		constants.MOC.toLowerCase().should.be.equal(
			(await keysManagerNewInstance.methods.masterOfCeremony().call()).toLowerCase()
		);
		(await keysManagerNewInstance.methods.proxyStorage().call()).should.be.equal(
			PROXY_STORAGE_NEW_ADDRESS
		);
		(await keysManagerNewInstance.methods.poaNetworkConsensus().call()).should.be.equal(
			POA_CONSENSUS_NEW_ADDRESS
		);
		for (let i = 0; i < initialKeysAddresses.length; i++) {
			(await keysManagerNewInstance.methods.getInitialKeyStatus(initialKeysAddresses[i]).call()).should.be.bignumber.equal(2);
		}
		for (let i = 0; i < constants.VALIDATOR.length; i++) {
			const miningKey = constants.VALIDATOR[i].mining;
			const votingKey = constants.VALIDATOR[i].voting;
			const payoutKey = constants.VALIDATOR[i].payout;
			console.log(`  Check mining key ${miningKey}...`);
			
			try {
				const validatorNewKeys = await keysManagerNewInstance.methods.validatorKeys(miningKey).call();
				validatorNewKeys[0].should.be.equal(votingKey); // validatorVotingKey
				validatorNewKeys[1].should.be.equal(payoutKey); // validatorPayoutKey
				validatorNewKeys[2].should.be.equal(true); // isValidatorMiningActive
				validatorNewKeys[3].should.be.equal(true); // isValidatorVotingActive
				validatorNewKeys[4].should.be.equal(true); // isValidatorPayoutActive
				(await keysManagerNewInstance.methods.miningKeyByPayout(payoutKey).call()).should.be.equal(
					miningKey
				);
				(await keysManagerNewInstance.methods.miningKeyByVoting(votingKey).call()).should.be.equal(
					miningKey
				);
				payoutKey.should.be.equal(
					await keysManagerNewInstance.methods.getPayoutByMining(miningKey).call()
				);
				votingKey.should.be.equal(
					await keysManagerNewInstance.methods.getVotingByMining(miningKey).call()
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
		console.log('Cannot deploy KeysManager:');
		console.log(err);
		process.exit(1);
	}
}

// POA_CONSENSUS_NEW_ADDRESS=0x... PROXY_STORAGE_NEW_ADDRESS=0x... node deployKeys
