const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');

let BALLOTS_STORAGE_NEW_ADDRESS = process.env.BALLOTS_STORAGE_NEW_ADDRESS;
let VOTING_TO_CHANGE_KEYS_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_KEYS_NEW_ADDRESS;
let VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS;
let VOTING_TO_CHANGE_PROXY_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_PROXY_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

let BALLOTS_STORAGE_NEW_ABI;
let VOTING_TO_CHANGE_KEYS_NEW_ABI;
let VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ABI;
let VOTING_TO_CHANGE_PROXY_NEW_ABI;

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

	if (!(await ballotsStorageDeployAndCheck(sender, key, chainId))) process.exit(1);
	if (!(await votingToChangeDeployAndCheck(sender, key, chainId, 'VotingToChangeKeys'))) process.exit(1);
	if (!(await votingToChangeDeployAndCheck(sender, key, chainId, 'VotingToChangeMinThreshold'))) process.exit(1);
	if (!(await votingToChangeDeployAndCheck(sender, key, chainId, 'VotingToChangeProxyAddress'))) process.exit(1);

	if (process.send) {
		process.send({
			ballotsStorageNewAddress: BALLOTS_STORAGE_NEW_ADDRESS,
			ballotsStorageNewAbi: BALLOTS_STORAGE_NEW_ABI,
			votingToChangeKeysNewAddress: VOTING_TO_CHANGE_KEYS_NEW_ADDRESS,
			votingToChangeKeysNewAbi: VOTING_TO_CHANGE_KEYS_NEW_ABI,
			votingToChangeMinThresholdNewAddress: VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS,
			votingToChangeMinThresholdNewAbi: VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ABI,
			votingToChangeProxyNewAddress: VOTING_TO_CHANGE_PROXY_NEW_ADDRESS,
			votingToChangeProxyNewAbi: VOTING_TO_CHANGE_PROXY_NEW_ABI
		});
		await setTimeout(() => {}, 1000);
	}
}

async function ballotsStorageDeployAndCheck(sender, key, chainId) {
	let success = false;

	try {
		console.log('BallotsStorage deployment...');

		const implCompiled = await utils.compile('../../contracts/', 'BallotsStorage');
		const implAddress = await utils.deploy('BallotsStorage', implCompiled, sender, key, chainId);
		console.log('  BallotsStorage implementation address is ' + implAddress);
		const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
		const contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		BALLOTS_STORAGE_NEW_ADDRESS = contractNewAddress;
		BALLOTS_STORAGE_NEW_ABI = implCompiled.abi;
		console.log('  BallotsStorage storage address is ' + contractNewAddress);

		const ballotsStorageNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);
		
		const init = ballotsStorageNewInstance.methods.init([3, 2]);
		await utils.call(init, sender, contractNewAddress, key, chainId);

		console.log('  Checking new contract...');
		(await ballotsStorageNewInstance.methods.getBallotThreshold(1).call()).should.be.bignumber.equal(3);
		(await ballotsStorageNewInstance.methods.getBallotThreshold(2).call()).should.be.bignumber.equal(2);

		PROXY_STORAGE_NEW_ADDRESS.should.be.equal(
			await ballotsStorageNewInstance.methods.proxyStorage().call()
		);
		true.should.be.equal(
			await ballotsStorageNewInstance.methods.initDisabled().call()
		);

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		console.log('Cannot deploy BallotsStorage:');
		console.log(err);
	}

	return success;
}

async function votingToChangeDeployAndCheck(sender, key, chainId, contractName) {
	let success = false;

	try {
		console.log(`${contractName} deployment...`);

		const implCompiled = await utils.compile('../../contracts/', contractName);
		const implAddress = await utils.deploy(contractName, implCompiled, sender, key, chainId);
		console.log(`  ${contractName} implementation address is ${implAddress}`);
		const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
		const contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		if (contractName == 'VotingToChangeKeys') {
			VOTING_TO_CHANGE_KEYS_NEW_ADDRESS = contractNewAddress;
			VOTING_TO_CHANGE_KEYS_NEW_ABI = implCompiled.abi;
		} else if (contractName == 'VotingToChangeMinThreshold') {
			VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS = contractNewAddress;
			VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ABI = implCompiled.abi;
		} else if (contractName == 'VotingToChangeProxyAddress') {
			VOTING_TO_CHANGE_PROXY_NEW_ADDRESS = contractNewAddress;
			VOTING_TO_CHANGE_PROXY_NEW_ABI = implCompiled.abi;
		}
		console.log(`  ${contractName} storage address is ${contractNewAddress}`);

		const votingNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		const initDisabled = await votingNewInstance.methods.initDisabled().call();
		if (!initDisabled) {
			let init;
			if (contractName == 'VotingToChangeMinThreshold') {
				init = await votingNewInstance.methods.init(172800, 2);
			} else {
				init = await votingNewInstance.methods.init(172800);
			}
			await utils.call(init, sender, contractNewAddress, key, chainId);
			(await votingNewInstance.methods.initDisabled().call()).should.be.equal(true);
		}

		console.log('  Disable migrations feature of the new contract...');
		await utils.call(votingNewInstance.methods.migrateDisable(), sender, contractNewAddress, key, chainId);
		(await votingNewInstance.methods.migrateDisabled().call()).should.be.equal(true);

		console.log('  Checking new contract...');
		for (let t = 0; t < 5; t++) {
			try {
				PROXY_STORAGE_NEW_ADDRESS.should.be.equal(await votingNewInstance.methods.proxyStorage().call());
			} catch (check_err) {
				if (check_err.message.indexOf('Invalid JSON RPC response') >= 0) {
					console.log('  Invalid JSON RPC response. Another try in 5 seconds...');
					await utils.sleep(5000);
					continue;
				} else {
					throw check_err;
				}
			}
			break;
		}

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		console.log(`Cannot deploy ${contractName}:`);
		console.log(err);
	}

	return success;
}
