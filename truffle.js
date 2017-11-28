module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    test: {
      host: "localhost",
      port: 8544,
      gas: 4600000,
      network_id: "*" // Match any network id
    }
  }
};
