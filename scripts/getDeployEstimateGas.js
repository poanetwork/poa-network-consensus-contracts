const fs = require('fs');
const solc = require('solc');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("https://core.poa.network"));

main();

async function main() {
	const dir = '../contracts/';
	const filenames = fs.readdirSync(dir);
	let contracts = ['EternalStorageProxy'];
	let maxContractNameLength = 0;

	for (let i = 0; i < filenames.length; i++) {
		const filename = filenames[i];
		const stats = fs.statSync(dir + filename);

		if (stats.isFile()) {
			const contractName = filename.replace('.sol', '');

			if (contractName == 'Migrations') {
				continue;
			}

			contracts.push(contractName);

			if (contractName.length > maxContractNameLength) {
				maxContractNameLength = contractName.length;
			}
		}
	}

	contracts.sort();

	for (let i = 0; i < contracts.length; i++) {
		const contractName = contracts[i];
		let arguments = [];
		let contractDir = dir;

		switch (contractName) {
		case 'EmissionFunds':
			arguments = ['0x2bc44a42f083907f47262a169674d699b02c3560'];
			break;

		case 'EternalStorageProxy':
			arguments = [
				'0x2bc44a42f083907f47262a169674d699b02c3560',
				'0x2bc44a42f083907f47262a169674d699b02c3561'
			];
			contractDir = `${dir}eternal-storage/`;
			break;

		case 'PoaNetworkConsensus':
			arguments = ['0x2bc44a42f083907f47262a169674d699b02c3560', []];
			break;
		}

		const compiled = await compile(contractDir, contractName);
		const gas = await estimateGas(compiled, arguments) / 1000000;
		const dotsCount = maxContractNameLength - contractName.length;
		const dots = '.'.repeat(dotsCount);
		
		console.log(contractName + ' ' + dots + ' ' + gas + ' Mgas');
	}
}

async function estimateGas(compiled, arguments) {
	const contract = new web3.eth.Contract(compiled.abi);
	const deploy = await contract.deploy({data: '0x' + compiled.bytecode, arguments: arguments});
	return await deploy.estimateGas();
}

async function compile(dir, contractName) {
	const compiled = solc.compile({
		sources: {
			'': fs.readFileSync(dir + contractName + '.sol').toString()
		}
	}, 1, function (path) {
		let content;
		try {
			content = fs.readFileSync(dir + path);
		} catch (e) {
			if (e.code == 'ENOENT') {
				content = fs.readFileSync(dir + '../' + path);
			}
		}
		return {
			contents: content.toString()
		}
	});
	const abi = JSON.parse(compiled.contracts[':' + contractName].interface);
	const bytecode = compiled.contracts[':' + contractName].bytecode;
	return {abi, bytecode};
}

// node getDeployEstimateGas.js