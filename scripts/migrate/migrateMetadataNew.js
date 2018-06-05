const Web3 = require('web3');
const EthereumUtil = require('ethereumjs-util');
const axios = require('axios');
const utils = require('./utils/utils');
const constants = require('./utils/constants');

const NETWORK = process.env.NETWORK; // sokol or core
const METADATA_NEW_ADDRESS = process.env.METADATA_NEW_ADDRESS;
const PROXY_STORAGE_NEW_ADDRESS = process.env.PROXY_STORAGE_NEW_ADDRESS;
const ONLY_CHECK = !!process.env.ONLY_CHECK === true

web3 = new Web3(new Web3.providers.HttpProvider("https://" + NETWORK + ".poa.network"));

require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(web3.BigNumber))
	.should();

let METADATA_OLD_ADDRESS;
let POA_ADDRESS;
let MOC_ADDRESS;
let METADATA_OLD_ABI;
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
		METADATA_OLD_ADDRESS = contracts.data.METADATA_ADDRESS;
		POA_ADDRESS = contracts.data.POA_ADDRESS;
		MOC_ADDRESS = EthereumUtil.toChecksumAddress(contracts.data.MOC);
		METADATA_OLD_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/ValidatorMetadata.abi.json')).data;
		POA_ABI = (await axios.get('https://raw.githubusercontent.com/poanetwork/poa-chain-spec/' + commit + '/abis/PoaNetworkConsensus.abi.json')).data;
		console.log('');
	} catch (err) {
		console.log('Cannot read contracts.json');
		success = false;
	}

	if (success) {
		if (ONLY_CHECK) {
			success = migrateAndCheck();
		} else {
			let privateKey = process.env.PRIVATE_KEY;
			if (!privateKey) privateKey = await utils.readPrivateKey();
			success = migrateAndCheck(privateKey);
		}
	}

	if (!success) {
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

	let success = false;
	let contractNewAddress = METADATA_NEW_ADDRESS;

	try {
		if (ONLY_CHECK) {
			console.log('ValidatorMetadata checking...');
		} else {
			console.log('ValidatorMetadata migration...');
		}

		const implCompiled = await utils.compile('../../contracts/', 'ValidatorMetadata');
		if (!contractNewAddress && !ONLY_CHECK) {
			const implAddress = await utils.deploy('ValidatorMetadata', implCompiled, sender, key, chainId);
			console.log('  ValidatorMetadata implementation address is ' + implAddress);
			const storageCompiled = await utils.compile('../../contracts/eternal-storage/', 'EternalStorageProxy');
			contractNewAddress = await utils.deploy('EternalStorageProxy', storageCompiled, sender, key, chainId, [PROXY_STORAGE_NEW_ADDRESS, implAddress]);
		}
		console.log('  ValidatorMetadata storage address is ' + contractNewAddress);

		const metadataOldInstance = new web3.eth.Contract(METADATA_OLD_ABI, METADATA_OLD_ADDRESS);
		const metadataNewInstance = new web3.eth.Contract(implCompiled.abi, contractNewAddress);
		const poaInstance = new web3.eth.Contract(POA_ABI, POA_ADDRESS);
		const validatorsLength = await poaInstance.methods.getCurrentValidatorsLength().call();
		
		if (!ONLY_CHECK) {
			console.log(`  Handle each of ${validatorsLength} validator(s)...`);
			for (let i = 0; i < validatorsLength; i++) {
				const miningKey = await poaInstance.methods.currentValidators(i).call();
				console.log(`  Migrate ${miningKey}...`);
				const validator = await metadataOldInstance.methods.validators(miningKey).call();

				if (validator.createdDate == 0 && miningKey == MOC_ADDRESS) {
					continue;
				}

				let validatorArray = [];
				for (let j = 0; j < 10; j++) {
					validatorArray[j] = validator[j];
				}
				validatorArray.push(miningKey);

				const initMetadata = metadataNewInstance.methods.initMetadata(...validatorArray);
				await utils.call(initMetadata, sender, contractNewAddress, key, chainId);
			}

			console.log('  Disable migrations feature of the new contract...');
			await utils.call(metadataNewInstance.methods.initMetadataDisable(), sender, contractNewAddress, key, chainId);
		}
		
		if (ONLY_CHECK) {
			console.log('  Checking the contract...');
		} else {
			console.log('  Checking new contract...');
		}
		for (let i = 0; i < validatorsLength; i++) {
			const miningKey = await poaInstance.methods.currentValidators(i).call();
			console.log(`  Check ${miningKey}...`);
			const validatorOld = await metadataOldInstance.methods.validators(miningKey).call();
			const validatorNew = await metadataNewInstance.methods.validators(miningKey).call();
			validatorOld.should.be.deep.equal(validatorNew);
		}

		console.log('Success');
		console.log('');
		success = true;
	} catch (err) {
		if (ONLY_CHECK) {
			console.log('Something is wrong: ' + err.message);
		} else {
			console.log('Cannot migrate ValidatorMetadata: ' + err.message);
		}
	}

	return success;
}

// Deploy, migrate and check:
//   NETWORK=sokol PROXY_STORAGE_NEW_ADDRESS=0x3f918617a055d48e90f9fe06c168a75134565190 node migrateMetadataNew

// Migrate and check without deploy:
//   NETWORK=sokol METADATA_NEW_ADDRESS=0xB4bBD4b13d1DeDa884C0b745774E975ea60b9aA2 node migrateMetadataNew

// Only check:
//   NETWORK=sokol METADATA_NEW_ADDRESS=0xB4bBD4b13d1DeDa884C0b745774E975ea60b9aA2 ONLY_CHECK=true node migrateMetadataNew
