const fs = require('fs');
const Web3 = require('web3');
const readline = require('readline');
var Writable = require('stream').Writable;
const EthereumTx = require('ethereumjs-tx');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const solc = require('solc');

const NETWORK = process.env.NETWORK; // sokol or core
const BALLOTS_STORAGE_NEW_ADDRESS = process.env.BALLOTS_STORAGE_NEW_ADDRESS;
const VOTING_TO_CHANGE_KEYS_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_KEYS_NEW_ADDRESS;
const VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS;
const VOTING_TO_CHANGE_PROXY_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_PROXY_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

const web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = 4700000;

let KEYS_MANAGER_ADDRESS;
let BALLOTS_STORAGE_OLD_ADDRESS;
let VOTING_TO_CHANGE_KEYS_OLD_ADDRESS;
let VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ADDRESS;
let VOTING_TO_CHANGE_PROXY_OLD_ADDRESS;
let POA_ADDRESS;

let KEYS_MANAGER_ABI;
let BALLOTS_STORAGE_OLD_ABI;
let VOTING_TO_CHANGE_KEYS_OLD_ABI;
let VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ABI;
let VOTING_TO_CHANGE_PROXY_OLD_ABI;
let POA_ABI;

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
		KEYS_MANAGER_ADDRESS = contracts.data.KEYS_MANAGER_ADDRESS;
		BALLOTS_STORAGE_OLD_ADDRESS = contracts.data.BALLOTS_STORAGE_ADDRESS;
		VOTING_TO_CHANGE_KEYS_OLD_ADDRESS = contracts.data.VOTING_TO_CHANGE_KEYS_ADDRESS;
		VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ADDRESS = contracts.data.VOTING_TO_CHANGE_MIN_THRESHOLD_ADDRESS;
		VOTING_TO_CHANGE_PROXY_OLD_ADDRESS = contracts.data.VOTING_TO_CHANGE_PROXY_ADDRESS;
		POA_ADDRESS = contracts.data.POA_ADDRESS;
		
		KEYS_MANAGER_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/KeysManager.abi.json')).data;
		BALLOTS_STORAGE_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/BallotsStorage.abi.json')).data;
		VOTING_TO_CHANGE_KEYS_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/VotingToChangeKeys.abi.json')).data;
		VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/VotingToChangeMinThreshold.abi.json')).data;
		VOTING_TO_CHANGE_PROXY_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/VotingToChangeProxyAddress.abi.json')).data;
		POA_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/PoaNetworkConsensus.abi.json')).data;
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

	if (!(await ballotsStorageMigrateAndCheck(sender, key, chainId))) return;
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeKeys'))) return;
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeMinThreshold'))) return;
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeProxyAddress'))) return;
}

async function ballotsStorageMigrateAndCheck(sender, key, chainId) {
	let success = false;
	let contractNewAddress = BALLOTS_STORAGE_NEW_ADDRESS;

	try {
		if (ONLY_CHECK) {
			console.log('BallotsStorage checking...');
		} else {
			console.log('BallotsStorage migration...');
		}

		const implCompiled = await compile('../../contracts/', 'BallotsStorage');
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await deploy('BallotsStorage', implCompiled, sender, key, chainId);
			console.log('  BallotsStorage implementation address is ' + implAddress);
			const storageCompiled = await compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		}
		console.log('  BallotsStorage storage address is ' + contractNewAddress);

		const ballotsStorageOldInstance = new web3.eth.Contract(BALLOTS_STORAGE_OLD_ABI, BALLOTS_STORAGE_OLD_ADDRESS);
		const ballotsStorageNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);
		
		if (!ONLY_CHECK) {
			const migrate = ballotsStorageNewInstance.methods.migrate(BALLOTS_STORAGE_OLD_ADDRESS);
			await call(migrate, sender, contractNewAddress, key, chainId);
		}
		
		const oldKeysThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(1).call();
		const newKeysThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(1).call();
		const oldMetadataThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(2).call();
		const newMetadataThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(2).call();

		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		oldKeysThreshold.should.be.equal(newKeysThreshold);
		oldMetadataThreshold.should.be.equal(newMetadataThreshold);

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong: ' + err.message);
		} else {
			console.log('Cannot migrate BallotsStorage: ' + err.message);
		}
	}

	return success;
}

async function votingToChangeMigrateAndCheck(sender, key, chainId, contractName) {
	let success = false;
	let contractNewAddress = '';
	let contractOldAddress = '';
	let contractOldAbi = '';

	if (contractName == 'VotingToChangeKeys') {
		contractNewAddress = VOTING_TO_CHANGE_KEYS_NEW_ADDRESS;
		contractOldAddress = VOTING_TO_CHANGE_KEYS_OLD_ADDRESS;
		contractOldAbi = VOTING_TO_CHANGE_KEYS_OLD_ABI;
	} else if (contractName == 'VotingToChangeMinThreshold') {
		contractNewAddress = VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS;
		contractOldAddress = VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ADDRESS;
		contractOldAbi = VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ABI;
	} else if (contractName == 'VotingToChangeProxyAddress') {
		contractNewAddress = VOTING_TO_CHANGE_PROXY_NEW_ADDRESS;
		contractOldAddress = VOTING_TO_CHANGE_PROXY_OLD_ADDRESS;
		contractOldAbi = VOTING_TO_CHANGE_PROXY_OLD_ABI;
	}

	try {
		if (ONLY_CHECK) {
			console.log(`${contractName} checking...`);
		} else {
			console.log(`${contractName} migration...`);
		}

		const implCompiled = await compile('../../contracts/', contractName);
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await deploy(contractName, implCompiled, sender, key, chainId);
			console.log(`  ${contractName} implementation address is ${implAddress}`);
			const storageCompiled = await compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		}
		console.log(`  ${contractName} storage address is ${contractNewAddress}`);

		const keysManagerInstance = new web3.eth.Contract(KEYS_MANAGER_ABI, KEYS_MANAGER_ADDRESS);
		const votingOldInstance = new web3.eth.Contract(contractOldAbi, contractOldAddress);
		const votingNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		const initDisabled = await votingNewInstance.methods.initDisabled().call();
		if (!initDisabled) {
			const init = await votingNewInstance.methods.init(false);
			await call(init, sender, contractNewAddress, key, chainId);
		}

		if (!ONLY_CHECK) {
			console.log('  Read Vote event...');
			let votingKeys = {};
			let events = await votingOldInstance.getPastEvents('Vote', {fromBlock: 0, toBlock: 'latest'});
			for (let i = 0; i < events.length; i++) {
				const ballotId = events[i].returnValues.id;
				if (typeof votingKeys[ballotId] === 'undefined') {
					votingKeys[ballotId] = [];
				}
				votingKeys[ballotId].push(events[i].returnValues.voter);
			}

			console.log('  Check totalVoters...');
			for (const ballotId in votingKeys) {
				const ballotTotalVoters = await votingOldInstance.methods.getTotalVoters(ballotId).call();
				votingKeys[ballotId].length.should.be.equal(Number(ballotTotalVoters));
			}

			console.log('  Set miningByVoting...');
			let miningByVoting = {};
			events = await keysManagerInstance.getPastEvents('ValidatorInitialized', {fromBlock: 0, toBlock: 'latest'});
			for (i = 0; i < events.length; i++) {
				miningByVoting[events[i].returnValues.votingKey] = events[i].returnValues.miningKey;
			}
			events = await keysManagerInstance.getPastEvents('VotingKeyChanged', {fromBlock: 0, toBlock: 'latest'});
			for (i = 0; i < events.length; i++) {
				if (events[i].returnValues.action == "added") {
					miningByVoting[events[i].returnValues.key] = events[i].returnValues.miningKey;
				}
			}
			for (const ballotId in votingKeys) {
				for (i = 0; i < votingKeys[ballotId].length; i++) {
					const votingKey = votingKeys[ballotId][i];

					if (typeof miningByVoting[votingKey] === 'undefined') {
						miningByVoting[votingKey] = await keysManagerInstance.methods.getMiningKeyByVoting(votingKey).call();
					}
				}
			}

			console.log('  Call migrateBasicAll...');
			const migrateBasicAll = votingNewInstance.methods.migrateBasicAll(contractOldAddress);
			await call(migrateBasicAll, sender, contractNewAddress, key, chainId);
			
			const nextBallotId = await votingOldInstance.methods.nextBallotId().call();
			console.log(`  Handle each of ${nextBallotId} ballot(s)...`);
			for (let ballotId = 0; ballotId < nextBallotId; ballotId++) {
				let voters = [];

				for (i = 0; i < votingKeys[ballotId].length; i++) {
					const votingKey = votingKeys[ballotId][i];

					if (miningByVoting[votingKey]) {
						voters.push(miningByVoting[votingKey]);
					}
				}

				const ballotTotalVoters = await votingOldInstance.methods.getTotalVoters(ballotId).call();
				voters.length.should.be.equal(Number(ballotTotalVoters));

				console.log(`  Migrate ballot #${ballotId}...`);
				const votingState = await votingOldInstance.methods.votingState(ballotId).call();
				const migrateBasicOne = votingNewInstance.methods.migrateBasicOne(
					ballotId,
					contractOldAddress,
					votingState.quorumState,
					votingState.index,
					votingState.creator,
					votingState.memo,
					voters
				);

				await call(migrateBasicOne, sender, contractNewAddress, key, chainId);
			}

			// console.log('  Disable migrations feature of the new contract...');
			// await call(votingNewInstance.methods.migrateDisable(), sender, contractNewAddress, key, chainId);
		}

		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		const poaInstance = new web3.eth.Contract(POA_ABI, POA_ADDRESS);
		(await votingOldInstance.methods.proxyStorage().call()).should.be.equal(await votingNewInstance.methods.proxyStorage().call());
		(await votingOldInstance.methods.maxOldMiningKeysDeepCheck().call()).should.be.equal(await votingNewInstance.methods.maxOldMiningKeysDeepCheck().call());
		(await votingOldInstance.methods.nextBallotId().call()).should.be.equal(await votingNewInstance.methods.nextBallotId().call());
		const activeBallotsLength = (await votingOldInstance.methods.activeBallotsLength().call());
		activeBallotsLength.should.be.equal(await votingNewInstance.methods.activeBallotsLength().call());
		for (let i = 0; i < activeBallotsLength; i++) {
			(await votingOldInstance.methods.activeBallots(i).call()).should.be.equal(await votingNewInstance.methods.activeBallots(i).call());
		}
		const currentValidatorsLength = await poaInstance.methods.getCurrentValidatorsLength().call();
		for (i = 0; i < currentValidatorsLength; i++) {
			const miningKey = await poaInstance.methods.currentValidators(i).call();
			(await votingOldInstance.methods.validatorActiveBallots(miningKey).call()).should.be.equal(await votingNewInstance.methods.validatorActiveBallots(miningKey).call());
		}
		const nextBallotId = (await votingOldInstance.methods.nextBallotId().call());
		for (i = 0; i < nextBallotId; i++) {
			console.log(`  Check ballot #${i}...`);
			
			const votingState = (await votingOldInstance.methods.votingState(i).call());
			
			votingState.startTime.should.be.equal(await votingNewInstance.methods.getStartTime(i).call());
			votingState.endTime.should.be.equal(await votingNewInstance.methods.getEndTime(i).call());
			votingState.totalVoters.should.be.equal(await votingNewInstance.methods.getTotalVoters(i).call());
			votingState.progress.should.be.equal(await votingNewInstance.methods.getProgress(i).call());
			votingState.isFinalized.should.be.equal(await votingNewInstance.methods.getIsFinalized(i).call());
			votingState.quorumState.should.be.equal(await votingNewInstance.methods.getQuorumState(i).call());
			votingState.index.should.be.equal(await votingNewInstance.methods.getIndex(i).call());
			votingState.minThresholdOfVoters.should.be.equal(await votingNewInstance.methods.getMinThresholdOfVoters(i).call());
			votingState.creator.should.be.equal(await votingNewInstance.methods.getCreator(i).call());
			votingState.memo.should.be.equal(await votingNewInstance.methods.getMemo(i).call());

			if (contractName == 'VotingToChangeKeys') {
				votingState.affectedKey.should.be.equal(await votingNewInstance.methods.getAffectedKey(i).call());
				votingState.affectedKeyType.should.be.equal(await votingNewInstance.methods.getAffectedKeyType(i).call());
				votingState.miningKey.should.be.equal(await votingNewInstance.methods.getMiningKey(i).call());
				votingState.ballotType.should.be.equal(await votingNewInstance.methods.getBallotType(i).call());
			} else if (contractName == 'VotingToChangeMinThreshold') {
				votingState.proposedValue.should.be.equal(await votingNewInstance.methods.getProposedValue(i).call());
			} else if (contractName == 'VotingToChangeProxyAddress') {
				votingState.proposedValue.should.be.equal(await votingNewInstance.methods.getProposedValue(i).call());
				votingState.contractType.should.be.equal(await votingNewInstance.methods.getContractType(i).call());
			}
		}

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		if (ONLY_CHECK) {
			console.log(`Something is wrong: ${err.message}`);
		} else {
			console.log(`Cannot migrate ${contractName}: ${err.message}`);
		}
	}

	return success;
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
//   NETWORK=sokol PROXY_STORAGE_NEW_ADDRESS=0x3f918617a055d48e90f9fe06c168a75134565190 node migrateVotings

// Init, migrate and check without deploy:
//   NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x87328334640AC9Fe199742101d66589487690Af5 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xaf378F31aB0A443be738ADbf04DeAc964fe935cA VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS=0xF333AC2046946969CF671747f72c7219e64A6739 VOTING_TO_CHANGE_PROXY_NEW_ADDRESS=0xf1c533332D09127921b83e830C45BbA35d3eB38b node migrateVotings

// Only check:
//   NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x87328334640AC9Fe199742101d66589487690Af5 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xaf378F31aB0A443be738ADbf04DeAc964fe935cA VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS=0xF333AC2046946969CF671747f72c7219e64A6739 VOTING_TO_CHANGE_PROXY_NEW_ADDRESS=0xf1c533332D09127921b83e830C45BbA35d3eB38b ONLY_CHECK=true node migrateVotings
