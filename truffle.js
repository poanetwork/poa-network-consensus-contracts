module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      gas: 6600000,
      network_id: "*" // Match any network id
    },
    test: {
      host: "localhost",
      port: 8544,
      gas: 6600000,
      network_id: "*" // Match any network id
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    sokol: {
      host: "localhost",
      port: 8545,
      gas: 6100000,
      network_id: "*" // Match any network id
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  mocha: {
    reporter: 'mochawesome',
    enableTimeouts: false
  }
};
