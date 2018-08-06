const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');

const NETWORK = process.env.NETWORK; // sokol or core
const KEYS_MANAGER_NEW_ADDRESS = process.env.KEYS_MANAGER_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

let KEYS_MANAGER_OLD_ADDRESS;
let POA_CONSENSUS_OLD_ADDRESS;
let VOTING_TO_CHANGE_KEYS_OLD_ADDRESS;
let MOC_ADDRESS;
let KEYS_MANAGER_OLD_ABI;
let POA_CONSENSUS_OLD_ABI;
let VOTING_TO_CHANGE_KEYS_OLD_ABI;

main();

async function main() {
	let success = true;
	let commit;

	if (NETWORK == 'core') {
		commit = process.env.CORE_COMMIT ? process.env.CORE_COMMIT : constants.CORE_COMMIT;
	} else if (NETWORK == 'sokol') {
		commit = process.env.SOKOL_COMMIT ? process.env.SOKOL_COMMIT : constants.SOKOL_COMMIT;
	}

	try {
		console.log('Retrieve addresses and ABIs...');
		let contracts = await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/contracts.json');
		KEYS_MANAGER_OLD_ADDRESS = contracts.data.KEYS_MANAGER_ADDRESS;
		POA_CONSENSUS_OLD_ADDRESS = contracts.data.POA_ADDRESS;
		VOTING_TO_CHANGE_KEYS_OLD_ADDRESS = contracts.data.VOTING_TO_CHANGE_KEYS_ADDRESS;
		MOC_ADDRESS = contracts.data.MOC;
		KEYS_MANAGER_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/KeysManager.abi.json')).data;
		POA_CONSENSUS_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/PoaNetworkConsensus.abi.json')).data;
		VOTING_TO_CHANGE_KEYS_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/VotingToChangeKeys.abi.json')).data;
		console.log('');
	} catch (err) {
		console.log('Cannot read contracts.json');
		success = false;
	}

	if (success) {
		if (ONLY_CHECK) {
			migrateAndCheck();
		} else {
			let privateKey = process.env.PRIVATE_KEY;
			if (!privateKey) privateKey = await utils.readPrivateKey();
			migrateAndCheck(privateKey);
		}
	} else {
		process.exit(1);
	}
}

async function migrateAndCheck(privateKey) {
	let key, sender, chainId;

	if (!ONLY_CHECK) {
		key = Buffer.from(privateKey, 'hex');
		sender = '0x' + EthereumUtil.privateToAddress(key).toString('hex');
		chainId = web3.utils.toHex(await web3.eth.net.getId());
	}

	let contractNewAddress = KEYS_MANAGER_NEW_ADDRESS;

	try {
		if (ONLY_CHECK) {
			console.log('KeysManager checking...');
		} else {
			console.log('KeysManager migration...');
		}

		const implCompiled = await utils.compile('../../contracts/', 'KeysManager');
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await utils.deploy('KeysManager', implCompiled, sender, key, chainId);
			console.log(`  KeysManager implementation address is ${implAddress}`);
			const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
			if (process.send) {
				process.send({
					keysManagerNewAddress: contractNewAddress,
					keysManagerNewAbi: implCompiled.abi
				});
			}
		}
		console.log(`  KeysManager storage address is ${contractNewAddress}`);

		const poaOldInstance = new web3.eth.Contract(POA_CONSENSUS_OLD_ABI, POA_CONSENSUS_OLD_ADDRESS);
		const keysManagerOldInstance = new web3.eth.Contract(KEYS_MANAGER_OLD_ABI, KEYS_MANAGER_OLD_ADDRESS);
		const keysManagerNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		let initialKeys = [];
		let events = await keysManagerOldInstance.getPastEvents('InitialKeyCreated', {fromBlock: 0, toBlock: 'latest'});
		for (let i = 0; i < events.length; i++) {
			initialKeys.push(events[i].returnValues.initialKey);
		}
		
		let miningKeys = await poaOldInstance.methods.getValidators().call();

		if (!ONLY_CHECK) {
			console.log('  Call init method...');
			const init = keysManagerNewInstance.methods.init(
				KEYS_MANAGER_OLD_ADDRESS
			);
			await utils.call(init, sender, contractNewAddress, key, chainId);

			console.log('  Migrate initial keys...');
			for (let i = 0; i < initialKeys.length; i++) {
				const migrateInitialKey = keysManagerNewInstance.methods.migrateInitialKey(
					initialKeys[i]
				);
				await utils.call(migrateInitialKey, sender, contractNewAddress, key, chainId);
			}

			const votingForKeysOldInstance = new web3.eth.Contract(VOTING_TO_CHANGE_KEYS_OLD_ABI, VOTING_TO_CHANGE_KEYS_OLD_ADDRESS);
			(await votingForKeysOldInstance.methods.maxOldMiningKeysDeepCheck().call()).should.be.bignumber.equal(25);
			(await keysManagerNewInstance.methods.maxOldMiningKeysDeepCheck().call()).should.be.bignumber.equal(25);

			console.log(`  Migrate each of ${miningKeys.length} mining key(s)...`);
			for (let i = 0; i < miningKeys.length; i++) {
				const miningKey = miningKeys[i];
				console.log(`  Migrate ${miningKey}...`);
				if (miningKey.toLowerCase() == MOC_ADDRESS.toLowerCase()) {
					continue;
				}
				const migrateMiningKey = keysManagerNewInstance.methods.migrateMiningKey(
					miningKey
				);
				await utils.call(migrateMiningKey, sender, contractNewAddress, key, chainId);
			}
		}
		
		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		MOC_ADDRESS.toLowerCase().should.be.equal(
			(await keysManagerNewInstance.methods.masterOfCeremony().call()).toLowerCase()
		);
		KEYS_MANAGER_OLD_ADDRESS.toLowerCase().should.be.equal(
			(await keysManagerNewInstance.methods.previousKeysManager().call()).toLowerCase()
		);
		(await keysManagerOldInstance.methods.maxNumberOfInitialKeys().call()).should.be.equal(
			await keysManagerNewInstance.methods.maxNumberOfInitialKeys().call()
		);
		(await keysManagerOldInstance.methods.initialKeysCount().call()).should.be.equal(
			await keysManagerNewInstance.methods.initialKeysCount().call()
		);
		(await keysManagerOldInstance.methods.maxLimitValidators().call()).should.be.equal(
			await keysManagerNewInstance.methods.maxLimitValidators().call()
		);
		for (let i = 0; i < initialKeys.length; i++) {
			const initialKey = initialKeys[i];
			(await keysManagerOldInstance.methods.getInitialKey(initialKey).call()).should.be.equal(
				await keysManagerNewInstance.methods.getInitialKeyStatus(initialKey).call()
			);
		}
		for (let i = 0; i < miningKeys.length; i++) {
			const miningKey = miningKeys[i];
			console.log(`  Check mining key ${miningKey}...`);
			(await keysManagerOldInstance.methods.validatorKeys(miningKey).call()).should.be.deep.equal(
				await keysManagerNewInstance.methods.validatorKeys(miningKey).call()
			);
			const votingKey = await keysManagerOldInstance.methods.getVotingByMining(miningKey).call();
			votingKey.should.be.equal(
				await keysManagerNewInstance.methods.getVotingByMining(miningKey).call()
			);
			(await keysManagerOldInstance.methods.miningKeyByVoting(votingKey).call()).should.be.equal(
				await keysManagerNewInstance.methods.miningKeyByVoting(votingKey).call()
			);
			if (miningKey.toLowerCase() != MOC_ADDRESS.toLowerCase()) {
				(await keysManagerNewInstance.methods.miningKeyByVoting(votingKey).call()).should.be.equal(
					miningKey
				);
			}
			let miningKeyHistoryOld = [];
			let currentMiningKey = miningKey;
			for (let j = 0; j < 25; j++) {
				const oldMiningKey = await keysManagerOldInstance.methods.miningKeyHistory(currentMiningKey).call();
				if (oldMiningKey == '0x0000000000000000000000000000000000000000') {
					break;
				}
				miningKeyHistoryOld.push(oldMiningKey);
				currentMiningKey = oldMiningKey;
			}
			let miningKeyHistoryNew = [];
			currentMiningKey = miningKey;
			for (let j = 0; j < 25; j++) {
				const oldMiningKey = await keysManagerNewInstance.methods.miningKeyHistory(currentMiningKey).call();
				if (oldMiningKey == '0x0000000000000000000000000000000000000000') {
					break;
				}
				miningKeyHistoryNew.push(oldMiningKey);
				currentMiningKey = oldMiningKey;
			}
			miningKeyHistoryOld.should.be.deep.equal(miningKeyHistoryNew);
		}
		
		console.log('Success');
		console.log('');
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong:');
			console.log(err);
		} else {
			console.log('Cannot migrate KeysManager:');
			console.log(err);
		}
		process.exit(1);
	}
}

// Deploy, init, migrate and check:
//   NETWORK=sokol PROXY_STORAGE_NEW_ADDRESS=0x3f918617a055d48e90f9fe06c168a75134565190 node migrateKeys

// Init, migrate and check without deploy:
//   NETWORK=sokol KEYS_MANAGER_NEW_ADDRESS=0x959C92248bde1b22433499e0D7ac7ab6452a005B node migrateKeys

// Only check:
//   NETWORK=sokol KEYS_MANAGER_NEW_ADDRESS=0x959C92248bde1b22433499e0D7ac7ab6452a005B ONLY_CHECK=true node migrateKeys
