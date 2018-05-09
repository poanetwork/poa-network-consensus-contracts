const NETWORK = process.env.NETWORK; // sokol or core
const METADATA_OLD_ADDRESS = process.env.METADATA_OLD_ADDRESS;
const METADATA_NEW_ADDRESS = process.env.METADATA_NEW_ADDRESS;

const Web3 = require('web3');
const readline = require('readline');
var Writable = require('stream').Writable;
const EthereumTx = require('ethereumjs-tx');
const EthereumUtil = require('ethereumjs-util');

web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = 4700000;

const metadataAbi = [{"constant":true,"inputs":[{"name":"_miningKey","type":"address"}],"name":"pendingChanges","outputs":[{"name":"firstName","type":"bytes32"},{"name":"lastName","type":"bytes32"},{"name":"licenseId","type":"bytes32"},{"name":"fullAddress","type":"string"},{"name":"state","type":"bytes32"},{"name":"zipcode","type":"bytes32"},{"name":"expirationDate","type":"uint256"},{"name":"createdDate","type":"uint256"},{"name":"updatedDate","type":"uint256"},{"name":"minThreshold","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_newProxyAddress","type":"address"}],"name":"pendingProxyConfirmations","outputs":[{"name":"count","type":"uint256"},{"name":"voters","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_firstName","type":"bytes32"},{"name":"_lastName","type":"bytes32"},{"name":"_licenseId","type":"bytes32"},{"name":"_fullAddress","type":"string"},{"name":"_state","type":"bytes32"},{"name":"_zipcode","type":"bytes32"},{"name":"_expirationDate","type":"uint256"}],"name":"createMetadata","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getBallotsStorage","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newProxyAddress","type":"address"}],"name":"setProxyAddress","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_miningKey","type":"address"}],"name":"confirmations","outputs":[{"name":"count","type":"uint256"},{"name":"voters","type":"address[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_miningKey","type":"address"}],"name":"finalize","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"implementation","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_votingKey","type":"address"}],"name":"getMiningByVotingKey","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_firstName","type":"bytes32"},{"name":"_lastName","type":"bytes32"},{"name":"_licenseId","type":"bytes32"},{"name":"_fullAddress","type":"string"},{"name":"_state","type":"bytes32"},{"name":"_zipcode","type":"bytes32"},{"name":"_expirationDate","type":"uint256"},{"name":"_createdDate","type":"uint256"},{"name":"_updatedDate","type":"uint256"},{"name":"_minThreshold","type":"uint256"},{"name":"_miningKey","type":"address"}],"name":"initMetadata","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_newProxyAddress","type":"address"}],"name":"confirmNewProxyAddress","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getKeysManager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_miningKey","type":"address"}],"name":"confirmPendingChange","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"proxyStorage","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_firstName","type":"bytes32"},{"name":"_lastName","type":"bytes32"},{"name":"_licenseId","type":"bytes32"},{"name":"_fullAddress","type":"string"},{"name":"_state","type":"bytes32"},{"name":"_zipcode","type":"bytes32"},{"name":"_expirationDate","type":"uint256"},{"name":"_miningKey","type":"address"}],"name":"changeRequestForValidator","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_firstName","type":"bytes32"},{"name":"_lastName","type":"bytes32"},{"name":"_licenseId","type":"bytes32"},{"name":"_fullAddress","type":"string"},{"name":"_state","type":"bytes32"},{"name":"_zipcode","type":"bytes32"},{"name":"_expirationDate","type":"uint256"}],"name":"changeRequest","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_miningKey","type":"address"}],"name":"onlyIfChangeExist","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingProxyStorage","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getMinThreshold","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_miningKey","type":"address"},{"name":"_voter","type":"address"}],"name":"isAddressAlreadyVoted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_newProxy","type":"address"},{"name":"_voter","type":"address"}],"name":"isAddressAlreadyVotedProxy","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"initMetadataDisable","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"cancelPendingChange","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_miningKey","type":"address"}],"name":"validators","outputs":[{"name":"firstName","type":"bytes32"},{"name":"lastName","type":"bytes32"},{"name":"licenseId","type":"bytes32"},{"name":"fullAddress","type":"string"},{"name":"state","type":"bytes32"},{"name":"zipcode","type":"bytes32"},{"name":"expirationDate","type":"uint256"},{"name":"createdDate","type":"uint256"},{"name":"updatedDate","type":"uint256"},{"name":"minThreshold","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"miningKey","type":"address"}],"name":"MetadataCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"miningKey","type":"address"}],"name":"ChangeRequestInitiated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"miningKey","type":"address"}],"name":"CancelledRequest","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"miningKey","type":"address"},{"indexed":false,"name":"votingSender","type":"address"}],"name":"Confirmed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"miningKey","type":"address"}],"name":"FinalizedChange","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"newProxyAddress","type":"address"}],"name":"RequestForNewProxy","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"newProxyAddress","type":"address"}],"name":"ChangeProxyStorage","type":"event"}];
const proxyStorageAbi = [{"constant": true,"inputs": [],"name": "getPoaConsensus","outputs": [{"name": "","type": "address"}],"payable": false,"stateMutability": "view","type": "function"}];
const poaConsensusAbi = [{"constant": true,"inputs": [],"name": "currentValidatorsLength","outputs": [{"name": "","type": "uint256"}],"payable": false,"stateMutability": "view","type": "function"},{"constant": true,"inputs": [{"name": "","type": "uint256"}],"name": "currentValidators","outputs": [{"name": "","type": "address"}],"payable": false,"stateMutability": "view","type": "function"}];

main();

async function migrate(privateKey) {
	console.log('Migration...');

	const privateKeyBuf = Buffer.from(privateKey, 'hex');
	const senderAddress = '0x' + EthereumUtil.privateToAddress(privateKeyBuf).toString('hex');

	const chainId = web3.utils.toHex(await web3.eth.net.getId());

	const metadataOldInstance = new web3.eth.Contract(metadataAbi, METADATA_OLD_ADDRESS);
	const metadataNewInstance = new web3.eth.Contract(metadataAbi, METADATA_NEW_ADDRESS);
	const proxyStorageAddress = await metadataOldInstance.methods.proxyStorage().call();
	const proxyStorageInstance = new web3.eth.Contract(proxyStorageAbi, proxyStorageAddress);
	const poaConsensusAddress = await proxyStorageInstance.methods.getPoaConsensus().call();
	const poaConsensusInstance = new web3.eth.Contract(poaConsensusAbi, poaConsensusAddress);
	
	const validatorsLength = await poaConsensusInstance.methods.currentValidatorsLength().call();
	
	let success = true;
	
	for (let i = 0; i < validatorsLength; i++) {
		const miningKey = await poaConsensusInstance.methods.currentValidators(i).call();
		const validator = await metadataOldInstance.methods.validators(miningKey).call();

		let validatorArray = [];
		for (let j = 0; j < 10; j++) {
			validatorArray[j] = validator[j];
		}
		validatorArray.push(miningKey);

		const initMetadata = metadataNewInstance.methods.initMetadata(...validatorArray);

		let estimateGas;

		try {
			estimateGas = await initMetadata.estimateGas({
				from: senderAddress,
				gas: web3.utils.toHex(GAS_LIMIT)
			});
		} catch (err) {
			const validatorNew = await metadataNewInstance.methods.validators(miningKey).call();

			let validatorNewArray = [];
			for (let j = 0; j < 10; j++) validatorNewArray[j] = validatorNew[j];
			validatorNewArray.push(miningKey);

			if (
				validatorArray.length == validatorNewArray.length &&
				validatorArray.every((v,k)=> v === validatorNewArray[k])
			) {
				// the same validator with the same data already exists in the new contract
				console.log(miningKey + '...success (already exists)');
			} else {
				console.log(miningKey + '...failed');
				success = false;
			}
			continue;
		}

		const nonce = await web3.eth.getTransactionCount(senderAddress);
		const nonceHex = web3.utils.toHex(nonce);
		const data = await initMetadata.encodeABI();

		var tx = new EthereumTx({
			nonce: nonceHex,
			gasPrice: web3.utils.toHex(GAS_PRICE),
			gasLimit: web3.utils.toHex(estimateGas),
			to: METADATA_NEW_ADDRESS,
			value: '0x00',
			data: data,
			chainId: chainId
		});

		tx.sign(privateKeyBuf);

		const serializedTx = tx.serialize();

		try {
			await web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'))

			const validatorNew = await metadataNewInstance.methods.validators(miningKey).call();
			
			let validatorNewArray = [];
			for (let j = 0; j < 10; j++) validatorNewArray[j] = validatorNew[j];
			validatorNewArray.push(miningKey);

			if (
				validatorArray.length == validatorNewArray.length &&
				validatorArray.every((v,k)=> v === validatorNewArray[k])
			) {
				// the data are the same in the new contract
				console.log(miningKey + '...success');
			} else {
				console.log(miningKey + '...failed');
				success = false;
			}
		} catch (err) {
			console.log(miningKey + '...failed');
			success = false;
		}
	}
	
	if (success) {
		// Disable migration if all metadata successfully migrated
		const initMetadataDisable = metadataNewInstance.methods.initMetadataDisable();
		
		try {
			const estimateGas = await initMetadataDisable.estimateGas({
				from: senderAddress,
				gas: web3.utils.toHex(GAS_LIMIT)
			});
			
			const nonce = await web3.eth.getTransactionCount(senderAddress);
			const nonceHex = web3.utils.toHex(nonce);
			const data = await initMetadataDisable.encodeABI();

			var tx = new EthereumTx({
				nonce: nonceHex,
				gasPrice: web3.utils.toHex(GAS_PRICE),
				gasLimit: web3.utils.toHex(estimateGas),
				to: METADATA_NEW_ADDRESS,
				value: '0x00',
				data: data,
				chainId: chainId
			});

			tx.sign(privateKeyBuf);

			const serializedTx = tx.serialize();
			
			await web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'))
			
			console.log('Migration successful');
		} catch (err) {
			console.log(err.message);
		}
	}
}

async function main() {
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
		migrate(privateKey);
	});
	
	mutableStdout.muted = true;
}

// NETWORK=sokol METADATA_OLD_ADDRESS=0xd4c9c95f1ac4eb5daceb4a67e3a7eefabf435232 METADATA_NEW_ADDRESS=0xf71dd3797e4f173c2c08f2cebe8a6801d8191b42 node migrateMetadataNew
// NETWORK=core METADATA_OLD_ADDRESS=0xb90ea07c213932d7ec6b540b35a0cae73af9c9b8 METADATA_NEW_ADDRESS=0x4c0eb450d8dfa6e89eb14ac154867bc86b3c559c node migrateMetadataNew