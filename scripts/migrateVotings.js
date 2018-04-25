const Web3 = require('web3');
const readline = require('readline');
var Writable = require('stream').Writable;
const EthereumTx = require('ethereumjs-tx');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');

const NETWORK = process.env.NETWORK; // sokol or core
const BALLOTS_STORAGE_NEW_ADDRESS = process.env.BALLOTS_STORAGE_NEW_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = 4700000;

let BALLOTS_STORAGE_OLD_ADDRESS;
let BALLOTS_STORAGE_ABI = [{"constant":true,"inputs":[],"name":"getMaxLimitBallot","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_ballotType","type":"uint8"}],"name":"getBallotThreshold","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"implementation","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newValue","type":"uint256"},{"name":"_thresholdType","type":"uint8"}],"name":"setThreshold","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"proxyStorage","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_demoMode","type":"bool"}],"name":"init","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getTotalNumberOfValidators","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_prevBallotsStorage","type":"address"}],"name":"migrate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getVotingToChangeThreshold","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getProxyThreshold","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getBallotLimitPerValidator","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"thresholdType","type":"uint8"},{"indexed":false,"name":"newValue","type":"uint256"}],"name":"ThresholdChanged","type":"event"}];

let commit;

if (NETWORK == 'core') {
	commit = '8a09d447d69c7239bba4827e97ed61d7d0092362';
} else if (NETWORK == 'sokol') {
	commit = '103dd4ee0f2a03e463108f0bba7a0db4fcdb83d3';
}

main();

async function main() {
	let success = true;

	try {
		let contracts = await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/contracts.json');
		BALLOTS_STORAGE_OLD_ADDRESS = contracts.data.BALLOTS_STORAGE_ADDRESS;
	} catch (err) {
		console.log('Cannot read contracts.json');
		success = false;
	}

	if (success) {
		readPrivateKey();
	}
}

async function migrate(privateKey) {
	console.log('BallotsStorage migration...');

	const privateKeyBuf = Buffer.from(privateKey, 'hex');
	const senderAddress = '0x' + EthereumUtil.privateToAddress(privateKeyBuf).toString('hex');

	const chainId = web3.utils.toHex(await web3.eth.net.getId());
	
	const ballotsStorageOldInstance = new web3.eth.Contract(BALLOTS_STORAGE_ABI, BALLOTS_STORAGE_OLD_ADDRESS);
	const ballotsStorageNewInstance = new web3.eth.Contract(BALLOTS_STORAGE_ABI, BALLOTS_STORAGE_NEW_ADDRESS);
	
	const migrate = ballotsStorageNewInstance.methods.migrate(BALLOTS_STORAGE_OLD_ADDRESS);
	
	try {
		const estimateGas = await migrate.estimateGas({
			from: senderAddress,
			gas: web3.utils.toHex(GAS_LIMIT)
		});
		
		const nonce = await web3.eth.getTransactionCount(senderAddress);
		const nonceHex = web3.utils.toHex(nonce);
		const data = await migrate.encodeABI();
		
		var tx = new EthereumTx({
			nonce: nonceHex,
			gasPrice: web3.utils.toHex(GAS_PRICE),
			gasLimit: web3.utils.toHex(estimateGas),
			to: BALLOTS_STORAGE_NEW_ADDRESS,
			value: '0x00',
			data: data,
			chainId: chainId
		});
		
		tx.sign(privateKeyBuf);

		const serializedTx = tx.serialize();
		
		await web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'));
		
		const oldKeysThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(1).call();
		const newKeysThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(1).call();
		const oldMetadataThreshold = await ballotsStorageOldInstance.methods.getBallotThreshold(2).call();
		const newMetadataThreshold = await ballotsStorageNewInstance.methods.getBallotThreshold(2).call();

		oldKeysThreshold.should.be.equal(newKeysThreshold);
		oldMetadataThreshold.should.be.equal(newMetadataThreshold);

		console.log('oldKeysThreshold = ' + oldKeysThreshold.toString());
		console.log('newKeysThreshold = ' + newKeysThreshold.toString());
		console.log('oldMetadataThreshold = ' + oldMetadataThreshold.toString());
		console.log('newMetadataThreshold = ' + newMetadataThreshold.toString());

		console.log('success');
	} catch (err) {
		console.log('Cannot migrate BallotsStorage: ' + err.message);
	}
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
		migrate(privateKey);
	});
	
	mutableStdout.muted = true;
}

// NETWORK=sokol BALLOTS_STORAGE_NEW_ADDRESS=0x56ce06301b1904aa1d1669c6bf8248da0a9fcf17 node migrateVotings