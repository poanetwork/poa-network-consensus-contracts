const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');

const NETWORK = process.env.NETWORK; // sokol or core
let BALLOTS_STORAGE_NEW_ADDRESS = process.env.BALLOTS_STORAGE_NEW_ADDRESS;
let VOTING_TO_CHANGE_KEYS_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_KEYS_NEW_ADDRESS;
let VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS;
let VOTING_TO_CHANGE_PROXY_NEW_ADDRESS = process.env.VOTING_TO_CHANGE_PROXY_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

let KEYS_MANAGER_ADDRESS;
let BALLOTS_STORAGE_OLD_ADDRESS;
let VOTING_TO_CHANGE_KEYS_OLD_ADDRESS;
let VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ADDRESS;
let VOTING_TO_CHANGE_PROXY_OLD_ADDRESS;
let POA_ADDRESS;

let KEYS_MANAGER_ABI;
let BALLOTS_STORAGE_OLD_ABI;
let BALLOTS_STORAGE_NEW_ABI;
let VOTING_TO_CHANGE_KEYS_OLD_ABI;
let VOTING_TO_CHANGE_KEYS_NEW_ABI;
let VOTING_TO_CHANGE_MIN_THRESHOLD_OLD_ABI;
let VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ABI;
let VOTING_TO_CHANGE_PROXY_OLD_ABI;
let VOTING_TO_CHANGE_PROXY_NEW_ABI;
let POA_ABI;

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

	if (!(await ballotsStorageMigrateAndCheck(sender, key, chainId))) process.exit(1);
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeKeys'))) process.exit(1);
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeMinThreshold'))) process.exit(1);
	if (!(await votingToChangeMigrateAndCheck(sender, key, chainId, 'VotingToChangeProxyAddress'))) process.exit(1);

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

async function ballotsStorageMigrateAndCheck(sender, key, chainId) {
	let success = false;
	let contractNewAddress = BALLOTS_STORAGE_NEW_ADDRESS;

	try {
		if (ONLY_CHECK) {
			console.log('BallotsStorage checking...');
		} else {
			console.log('BallotsStorage migration...');
		}

		const implCompiled = await utils.compile('../../contracts/', 'BallotsStorage');
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await utils.deploy('BallotsStorage', implCompiled, sender, key, chainId);
			console.log('  BallotsStorage implementation address is ' + implAddress);
			const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
			BALLOTS_STORAGE_NEW_ADDRESS = contractNewAddress;
			BALLOTS_STORAGE_NEW_ABI = implCompiled.abi;
		}
		console.log('  BallotsStorage storage address is ' + contractNewAddress);

		const ballotsStorageOldInstance = new web3.eth.Contract(BALLOTS_STORAGE_OLD_ABI, BALLOTS_STORAGE_OLD_ADDRESS);
		const ballotsStorageNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);
		
		if (!ONLY_CHECK) {
			const migrate = ballotsStorageNewInstance.methods.migrate(BALLOTS_STORAGE_OLD_ADDRESS);
			await utils.call(migrate, sender, contractNewAddress, key, chainId);
		}

		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		const oldKeysThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(1).call();
		const newKeysThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(1).call();
		const oldMetadataThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(2).call();
		const newMetadataThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(2).call();

		oldKeysThreshold.should.be.equal(newKeysThreshold);
		oldMetadataThreshold.should.be.equal(newMetadataThreshold);

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong:');
			console.log(err);
		} else {
			console.log('Cannot migrate BallotsStorage:');
			console.log(err);
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

		const implCompiled = await utils.compile('../../contracts/', contractName);
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await utils.deploy(contractName, implCompiled, sender, key, chainId);
			console.log(`  ${contractName} implementation address is ${implAddress}`);
			const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
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
		}
		console.log(`  ${contractName} storage address is ${contractNewAddress}`);

		const keysManagerInstance = new web3.eth.Contract(KEYS_MANAGER_ABI, KEYS_MANAGER_ADDRESS);
		const votingOldInstance = new web3.eth.Contract(contractOldAbi, contractOldAddress);
		const votingNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);

		const initDisabled = await votingNewInstance.methods.initDisabled().call();
		if (!initDisabled) {
			let init;
			if (contractName == 'VotingToChangeMinThreshold') {
				init = await votingNewInstance.methods.init(172800, 3);
			} else {
				init = await votingNewInstance.methods.init(172800);
			}
			await utils.call(init, sender, contractNewAddress, key, chainId);
			(await votingNewInstance.methods.initDisabled().call()).should.be.equal(true);
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
			await utils.call(migrateBasicAll, sender, contractNewAddress, key, chainId);
			
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
					voters
				);

				await utils.call(migrateBasicOne, sender, contractNewAddress, key, chainId);
			}

			console.log('  Disable migrations feature of the new contract...');
			await utils.call(votingNewInstance.methods.migrateDisable(), sender, contractNewAddress, key, chainId);
			(await votingNewInstance.methods.migrateDisabled().call()).should.be.equal(true);
		}

		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		for (let t = 0; t < 5; t++) {
			try {
				const poaInstance = new web3.eth.Contract(POA_ABI, POA_ADDRESS);
				PROXY_STORAGE_NEW_ADDRESS.should.be.equal(await votingNewInstance.methods.proxyStorage().call());
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
					let ballotInfo;

					if (contractName == 'VotingToChangeKeys') {
						ballotInfo = await votingNewInstance.methods.getBallotInfo(i).call();
						votingState.affectedKey.should.be.equal(ballotInfo.affectedKey);
						votingState.affectedKeyType.should.be.equal(ballotInfo.affectedKeyType);
						votingState.miningKey.should.be.equal(ballotInfo.miningKey);
						votingState.ballotType.should.be.equal(ballotInfo.ballotType);
					} else if (contractName == 'VotingToChangeMinThreshold') {
						ballotInfo = await votingNewInstance.methods.getBallotInfo(i, '0x0000000000000000000000000000000000000000').call();
						votingState.proposedValue.should.be.equal(ballotInfo.proposedValue);
					} else if (contractName == 'VotingToChangeProxyAddress') {
						ballotInfo = await votingNewInstance.methods.getBallotInfo(i, '0x0000000000000000000000000000000000000000').call();
						votingState.proposedValue.should.be.equal(ballotInfo.proposedValue);
						votingState.contractType.should.be.equal(ballotInfo.contractType);
					}

					votingState.startTime.should.be.equal(ballotInfo.startTime);
					votingState.endTime.should.be.equal(ballotInfo.endTime);
					votingState.totalVoters.should.be.equal(ballotInfo.totalVoters);
					votingState.progress.should.be.equal(ballotInfo.progress);
					votingState.isFinalized.should.be.equal(ballotInfo.isFinalized);
					votingState.quorumState.should.be.equal(await votingNewInstance.methods.getQuorumState(i).call());
					votingState.index.should.be.equal(await votingNewInstance.methods.getIndex(i).call());
					votingState.minThresholdOfVoters.should.be.equal(await votingNewInstance.methods.getMinThresholdOfVoters(i).call());
					votingState.creator.should.be.equal(ballotInfo.creator);
					votingState.memo.should.be.equal(ballotInfo.memo);
				}
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
		if (ONLY_CHECK) {
			console.log(`Something is wrong:`);
			console.log(err);
		} else {
			console.log(`Cannot migrate ${contractName}:`);
			console.log(err);
		}
	}

	return success;
}

// Deploy, init, migrate and check:
//   NETWORK=sokol PROXY_STORAGE_NEW_ADDRESS=0x3f918617a055d48e90f9fe06c168a75134565190 node migrateVotings

// Init, migrate and check without deploy:
//   NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x87328334640AC9Fe199742101d66589487690Af5 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xaf378F31aB0A443be738ADbf04DeAc964fe935cA VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS=0xF333AC2046946969CF671747f72c7219e64A6739 VOTING_TO_CHANGE_PROXY_NEW_ADDRESS=0xf1c533332D09127921b83e830C45BbA35d3eB38b node migrateVotings

// Only check:
//   NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x87328334640AC9Fe199742101d66589487690Af5 VOTING_TO_CHANGE_KEYS_NEW_ADDRESS=0xaf378F31aB0A443be738ADbf04DeAc964fe935cA VOTING_TO_CHANGE_MIN_THRESHOLD_NEW_ADDRESS=0xF333AC2046946969CF671747f72c7219e64A6739 VOTING_TO_CHANGE_PROXY_NEW_ADDRESS=0xf1c533332D09127921b83e830C45BbA35d3eB38b ONLY_CHECK=true node migrateVotings
