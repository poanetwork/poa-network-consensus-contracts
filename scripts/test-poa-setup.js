const Web3 = require('web3');
const localhost = 'http://localhost';
const PORT = process.env.PORT;
const UNLOCKED_ADDRESS = process.env.UNLOCKED_ADDRESS;
const provider = new Web3.providers.HttpProvider(`${localhost}:${PORT}`);
const web3 = new Web3(provider);
const GAS_PRICE = web3.utils.toWei('1', 'gwei');
const GAS_LIMIT = '4700000';
const addresses = require('./addresses');
const KeysManagerABI = require('../build/contracts/KeysManager.json').abi;
const keysManager = new web3.eth.Contract(KeysManagerABI, addresses.keysManager, {
    from: UNLOCKED_ADDRESS, // default from address
    gasPrice: GAS_PRICE,
    gas: GAS_LIMIT // default gas price in wei
});

async function sendMoneyToKeys(type){
  const keys = Object.keys(addresses);
  keys.forEach(async (miner) => {
    const minerAddresses = addresses[miner];
    const receipt = await sendMoney({
      to: minerAddresses[type],
      from: UNLOCKED_ADDRESS
    })
    console.log(receipt.transactionHash)
  })
}

async function sendMoney({to, from}){
  return await web3.eth.sendTransaction({
    to,
    value: '1000000000000000000',
    from,
    gasPrice: web3.utils.toHex('1000000000')
  })
}

async function initializeKeys(key) {
  const receipt = await keysManager.methods.initiateKeys(key).send({from: addresses.masterCeremony.mining});
  console.log('Initial Key', receipt.status)
}
async function createKeys(miner){
  const receipt = await keysManager.methods.createKeys(miner.mining, miner.voting, miner.payout).send({from: miner.initial});
  console.log('CreateKeys ', receipt.status)
}


async function main(){
  // await sendMoneyToKeys('initial')
  // await sendMoneyToKeys('voting')
  await initializeKeys(addresses.sixthMiner.initial);
  await createKeys(addresses.sixthMiner);

}
main()

// PORT=8551 UNLOCKED_ADDRESS=0x030B90762Cee7a87ee4f51e715a302177043835e node test-poa-setup.js