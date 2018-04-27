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
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

const web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = 4700000;

let PROXY_STORAGE_ADDRESS;
let KEYS_MANAGER_ADDRESS;
let BALLOTS_STORAGE_OLD_ADDRESS;
let VOTING_TO_CHANGE_KEYS_OLD_ADDRESS;
let POA_ADDRESS;

let KEYS_MANAGER_ABI;
let POA_ABI;
let BALLOTS_STORAGE_OLD_ABI;
let VOTING_TO_CHANGE_KEYS_OLD_ABI;

main();

async function main() {
	let success = true;
	let commit;

	if (NETWORK == 'core') {
		commit = '8a09d447d69c7239bba4827e97ed61d7d0092362';
	} else if (NETWORK == 'sokol') {
		commit = '103dd4ee0f2a03e463108f0bba7a0db4fcdb83d3';
	}

	try {
		let contracts = await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/contracts.json');
		PROXY_STORAGE_ADDRESS = contracts.data.PROXY_ADDRESS;
		KEYS_MANAGER_ADDRESS = contracts.data.KEYS_MANAGER_ADDRESS;
		BALLOTS_STORAGE_OLD_ADDRESS = contracts.data.BALLOTS_STORAGE_ADDRESS;
		VOTING_TO_CHANGE_KEYS_OLD_ADDRESS = contracts.data.VOTING_TO_CHANGE_KEYS_ADDRESS;
		POA_ADDRESS = contracts.data.POA_ADDRESS;
		
		KEYS_MANAGER_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/KeysManager.abi.json')).data;
		POA_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/PoaNetworkConsensus.abi.json')).data;
		BALLOTS_STORAGE_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/BallotsStorage.abi.json')).data;
		VOTING_TO_CHANGE_KEYS_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/VotingToChangeKeys.abi.json')).data;
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

	try {
		if (ONLY_CHECK) {
			console.log('BallotsStorage checking...');
		} else {
			console.log('BallotsStorage migration...');
		}

		const implCompiled = await compile('../../contracts/', 'BallotsStorage');
		let storageAddress = BALLOTS_STORAGE_NEW_ADDRESS;
		if (!storageAddress && !ONLY_CHECK) {
			const implAddress = await deploy('BallotsStorage', implCompiled, sender, key, chainId);
			console.log('  BallotsStorage implementation address is ' + implAddress);
			const storageCompiled = await compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			storageAddress = await deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_ADDRESS, implAddress]);
		}
		console.log('  BallotsStorage storage address is ' + storageAddress);

		const ballotsStorageOldInstance = new web3.eth.Contract(BALLOTS_STORAGE_OLD_ABI, BALLOTS_STORAGE_OLD_ADDRESS);
		const ballotsStorageNewInstance = new web3.eth.Contract(implCompiled.abi, storageAddress);
		
		if (!ONLY_CHECK) {
			const migrate = ballotsStorageNewInstance.methods.migrate(BALLOTS_STORAGE_OLD_ADDRESS);
			await call(migrate, sender, storageAddress, key, chainId);
		}
		
		const oldKeysThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(1).call();
		const newKeysThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(1).call();
		const oldMetadataThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(2).call();
		const newMetadataThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(2).call();

		oldKeysThreshold.should.be.equal(newKeysThreshold);
		oldMetadataThreshold.should.be.equal(newMetadataThreshold);

		console.log('Success');
		console.log('');
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong: ' + err.message);
		} else {
			console.log('Cannot migrate BallotsStorage: ' + err.message);
		}
		return;
	}

	try {
		if (ONLY_CHECK) {
			console.log('VotingToChangeKeys checking...');
		} else {
			console.log('VotingToChangeKeys migration...');
		}

		const implCompiled = await compile('../../contracts/', 'VotingToChangeKeys');
		let storageAddress = VOTING_TO_CHANGE_KEYS_NEW_ADDRESS;
		if (!storageAddress && !ONLY_CHECK) {
			const implAddress = await deploy('VotingToChangeKeys', implCompiled, sender, key, chainId);
			console.log('  VotingToChangeKeys implementation address is ' + implAddress);
			const storageCompiled = await compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			storageAddress = await deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_ADDRESS, implAddress]);
		}
		console.log('  VotingToChangeKeys storage address is ' + storageAddress);

		const keysManagerInstance = new web3.eth.Contract(KEYS_MANAGER_ABI, KEYS_MANAGER_ADDRESS);
		const votingOldInstance = new web3.eth.Contract(VOTING_TO_CHANGE_KEYS_OLD_ABI, VOTING_TO_CHANGE_KEYS_OLD_ADDRESS);
		const votingNewInstance = new web3.eth.Contract(implCompiled.abi, storageAddress);

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
			const migrateBasicAll = votingNewInstance.methods.migrateBasicAll(VOTING_TO_CHANGE_KEYS_OLD_ADDRESS);
			await call(migrateBasicAll, sender, storageAddress, key, chainId);
			
			const nextBallotId = await votingOldInstance.methods.nextBallotId().call();
			console.log('  Handle each of ' + nextBallotId + ' ballot(s)...');
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

				console.log('  Migrate ballot #' + ballotId + '...');
				const votingState = await votingOldInstance.methods.votingState(ballotId).call();
				const migrateBasicOne = votingNewInstance.methods.migrateBasicOne(
					ballotId,
					VOTING_TO_CHANGE_KEYS_OLD_ADDRESS,
					votingState.quorumState,
					votingState.index,
					votingState.creator,
					votingState.memo,
					voters
				);

				await call(migrateBasicOne, sender, storageAddress, key, chainId);
			}

			// console.log('  Disable migrations feature of the new contract...');
			// await call(votingNewInstance.methods.migrateDisable(), sender, storageAddress, key, chainId);
		}

		console.log('  Checking new contract...');
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
			console.log('  Check ballot #' + i + '...');
			const votingState = (await votingOldInstance.methods.votingState(i).call());
			votingState.startTime.should.be.equal(await votingNewInstance.methods.getStartTime(i).call());
			votingState.endTime.should.be.equal(await votingNewInstance.methods.getEndTime(i).call());
			votingState.affectedKey.should.be.equal(await votingNewInstance.methods.getAffectedKey(i).call());
			votingState.affectedKeyType.should.be.equal(await votingNewInstance.methods.getAffectedKeyType(i).call());
			votingState.miningKey.should.be.equal(await votingNewInstance.methods.getMiningKey(i).call());
			votingState.totalVoters.should.be.equal(await votingNewInstance.methods.getTotalVoters(i).call());
			votingState.progress.should.be.equal(await votingNewInstance.methods.getProgress(i).call());
			votingState.isFinalized.should.be.equal(await votingNewInstance.methods.getIsFinalized(i).call());
			votingState.quorumState.should.be.equal(await votingNewInstance.methods.getQuorumState(i).call());
			votingState.ballotType.should.be.equal(await votingNewInstance.methods.getBallotType(i).call());
			votingState.index.should.be.equal(await votingNewInstance.methods.getIndex(i).call());
			votingState.minThresholdOfVoters.should.be.equal(await votingNewInstance.methods.getMinThresholdOfVoters(i).call());
			votingState.creator.should.be.equal(await votingNewInstance.methods.getCreator(i).call());
			votingState.memo.should.be.equal(await votingNewInstance.methods.getMemo(i).call());
		}

		console.log('Success');
		console.log('');
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong: ' + err.message);
		} else {
			console.log('Cannot migrate VotingToChangeKeys: ' + err.message);
		}
		return;
	}
}

async function compile(dir, contractName) {
	console.log('  ' + contractName + ' compile...');
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
	console.log('  ' + contractName + ' deploy...');
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

// NETWORK=sokol node migrateVotings
// NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x498e4064fa1634662E0E87438c2BbDC7b2eE5458 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xE1fbA5Dd67F9c4D948B5c6f81B04DD25e0f3F896 node migrateVotings
// NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x498e4064fa1634662E0E87438c2BbDC7b2eE5458 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xE1fbA5Dd67F9c4D948B5c6f81B04DD25e0f3F896 ONLY_CHECK=true node migrateVotings