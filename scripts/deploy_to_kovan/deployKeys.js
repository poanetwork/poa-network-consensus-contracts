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
		console.log('KeysManager deployment...');

		const implCompiled = await utils.compile('../../contracts/', 'KeysManager');
		const implAddress = await utils.deploy('KeysManager', implCompiled, sender, key, chainId);
		console.log(`  KeysManager implementation address is ${implAddress}`);
		const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
		let contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);

		console.log(`  KeysManager storage address is ${contractNewAddress}`);

		const keysManagerNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		console.log('  Call init method...');
		const init = keysManagerNewInstance.methods.init(
			'0x0000000000000000000000000000000000000000'
		);
		await utils.call(init, sender, contractNewAddress, key, chainId);

		(await keysManagerNewInstance.methods.maxOldMiningKeysDeepCheck().call()).should.be.bignumber.equal(25);
		(await keysManagerNewInstance.methods.maxNumberOfInitialKeys().call()).should.be.bignumber.equal(constants.VALIDATOR.length);

		console.log('  Checking new contract...');
		true.should.be.equal(
			await keysManagerNewInstance.methods.initDisabled().call()
		);
		process.env.MOC.toLowerCase().should.be.equal(
			(await keysManagerNewInstance.methods.masterOfCeremony().call()).toLowerCase()
		);
		(await keysManagerNewInstance.methods.proxyStorage().call()).should.be.equal(
			PROXY_STORAGE_NEW_ADDRESS
		);
		(await keysManagerNewInstance.methods.poaNetworkConsensus().call()).should.be.equal(
			POA_CONSENSUS_NEW_ADDRESS
		);

		console.log('Success');
		console.log('');

		if (process.send) {
			process.send({
				keysManagerNewAddress: contractNewAddress,
				keysManagerNewAbi: implCompiled.abi
			});
			await setTimeout(() => {}, 1000);
		}
	} catch (err) {
		console.log('Cannot deploy KeysManager:');
		console.log(err);
		process.exit(1);
	}
}
