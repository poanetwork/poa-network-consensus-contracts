const fs = require('fs');
const Web3 = require('web3');
const readline = require('readline');
var Writable = require('stream').Writable;
const EthereumTx = require('ethereumjs-tx');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const solc = require('solc');

const NETWORK = process.env.NETWORK; // sokol or core
const KEYS_MANAGER_NEW_ADDRESS = process.env.KEYS_MANAGER_NEW_ADDRESS;
const POA_CONSENSUS_NEW_ADDRESS = process.env.POA_CONSENSUS_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

const web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = 4700000;

let KEYS_MANAGER_OLD_ADDRESS;
let POA_CONSENSUS_OLD_ADDRESS;
let MOC_ADDRESS;
let KEYS_MANAGER_OLD_ABI;
let POA_CONSENSUS_OLD_ABI;

main();

async function main() {
	let success = true;
	let commit;

	if (NETWORK == 'core') {
		commit = 'fb311a6c475e37bd9ccc0781b369cf14d738f98e';
	} else if (NETWORK == 'sokol') {
		commit = '4e020b68a3d477e1c41859c3f0402c0626254529';
	}

	try {
		console.log('Retrieve addresses and ABIs...');
		
		let contracts = await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/contracts.json');
		KEYS_MANAGER_OLD_ADDRESS = contracts.data.KEYS_MANAGER_ADDRESS;
		POA_CONSENSUS_OLD_ADDRESS = contracts.data.POA_ADDRESS;
		MOC_ADDRESS = contracts.data.MOC;
		KEYS_MANAGER_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/KeysManager.abi.json')).data;
		POA_CONSENSUS_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/PoaNetworkConsensus.abi.json')).data;
	} catch (err) {
		console.log('Cannot read contracts.json');
		success = false;
	}

	if (success) {
		if (ONLY_CHECK) {
			migrateAndCheck();
		} else {
			readPrivateKey();
		}
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

		const implCompiled = await compile('../../contracts/', 'KeysManager');
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await deploy('KeysManager', implCompiled, sender, key, chainId);
			console.log(`  KeysManager implementation address is ${implAddress}`);
			const storageCompiled = await compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
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
				POA_CONSENSUS_NEW_ADDRESS,
				MOC_ADDRESS,
				KEYS_MANAGER_OLD_ADDRESS
			);
			await call(init, sender, contractNewAddress, key, chainId);

			console.log('  Migrate initial keys...');
			for (let i = 0; i < initialKeys.length; i++) {
				const migrateInitialKey = keysManagerNewInstance.methods.migrateInitialKey(
					initialKeys[i]
				);
				await call(migrateInitialKey, sender, contractNewAddress, key, chainId);
			}

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
				await call(migrateMiningKey, sender, contractNewAddress, key, chainId);
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
				await keysManagerNewInstance.methods.getInitialKey(initialKey).call()
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
			console.log('Something is wrong: ' + err.message);
		} else {
			console.log('Cannot migrate KeysManager: ' + err.message);
		}
	}
}

async function compile(dir, contractName) {
	console.log(`  ${contractName} compile...`);
	const compiled = solc.compile({
		sources: {
			'': fs.readFileSync(dir + contractName + '.sol').toString()
		}
	}, 1, function (path) {
		return {contents: fs.readFileSync(dir + path).toString()}
	});
	const abi = JSON.parse(compiled.contracts[':' + contractName].interface);
	const bytecode = compiled.contracts[':' + contractName].bytecode;
	return {abi: abi, bytecode: bytecode};
}

async function deploy(contractName, contractSpec, sender, key, chainId, args) {
	console.log(`  ${contractName} deploy...`);
	const contract = new web3.eth.Contract(contractSpec.abi);
	const deploy = await contract.deploy({data: '0x' + contractSpec.bytecode, arguments: args});
	return (await call(deploy, sender, '', key, chainId)).contractAddress;
}

async function call(method, from, to, key, chainId) {
	const estimateGas = await method.estimateGas({
		from: from,
		gas: web3.utils.toHex(GAS_LIMIT)
	});

	const nonce = await web3.eth.getTransactionCount(from);
	const nonceHex = web3.utils.toHex(nonce);
	const data = await method.encodeABI();
	
	var tx = new EthereumTx({
		nonce: nonceHex,
		gasPrice: web3.utils.toHex(GAS_PRICE),
		gasLimit: web3.utils.toHex(estimateGas),
		to: to,
		value: '0x00',
		data: data,
		chainId: chainId
	});
	
	tx.sign(key);

	const serializedTx = tx.serialize();
	
	return (await web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex')));
}

async function readPrivateKey() {
	var mutableStdout = new Writable({
		write: function(chunk, encoding, callback) {
			if (!this.muted) {
				process.stdout.write(chunk, encoding);
			}
			callback();
		}
	});
	
	mutableStdout.muted = false;
	
	const readlineInterface = readline.createInterface({
		input: process.stdin,
		output: mutableStdout,
		terminal: true
	});

	readlineInterface.question('Enter your private key: ', (privateKey) => {
		readlineInterface.close();
		console.log('');
		console.log('');
		migrateAndCheck(privateKey);
	});
	
	mutableStdout.muted = true;
}

// Deploy, init, migrate and check:
//   NETWORK=sokol POA_CONSENSUS_NEW_ADDRESS=0x03048F666359CFD3C74a1A5b9a97848BF71d5038 PROXY_STORAGE_NEW_ADDRESS=0x3f918617a055d48e90f9fe06c168a75134565190 node migrateKeys

// Init, migrate and check without deploy:
//   NETWORK=sokol POA_CONSENSUS_NEW_ADDRESS=0x03048F666359CFD3C74a1A5b9a97848BF71d5038 KEYS_MANAGER_NEW_ADDRESS=0x959C92248bde1b22433499e0D7ac7ab6452a005B node migrateKeys

// Only check:
//   NETWORK=sokol KEYS_MANAGER_NEW_ADDRESS=0x959C92248bde1b22433499e0D7ac7ab6452a005B ONLY_CHECK=true node migrateKeys
