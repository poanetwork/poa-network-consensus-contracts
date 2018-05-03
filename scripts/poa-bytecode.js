const fs = require('fs');
const solc = require('solc');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("https://core.poa.network"));

main();

async function main() {
	console.log('PoaNetworkConsensus compilation...');
	const compiled = solc.compile({
		sources: {
			'': fs.readFileSync('../contracts/PoaNetworkConsensus.sol').toString()
		}
	}, 1, function (path) {
		return {contents: fs.readFileSync('../contracts/' + path).toString()}
	});
	const abi = JSON.parse(compiled.contracts[':PoaNetworkConsensus'].interface);
	let bytecode = compiled.contracts[':PoaNetworkConsensus'].bytecode;
	
	const contract = new web3.eth.Contract(abi);
	const deploy = await contract.deploy({data: '0x' + bytecode, arguments: [process.env.MASTER_OF_CEREMONY, []]});
	bytecode = await deploy.encodeABI();
	
	console.log('PoaNetworkConsensus bytecode:');
	console.log('');
	console.log(bytecode);
}

// MASTER_OF_CEREMONY=0x0039F22efB07A647557C7C5d17854CFD6D489eF3 node poa-bytecode.js