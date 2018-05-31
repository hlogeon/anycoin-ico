var SafeMath = artifacts.require('./SafeMath.sol');
var AnythingAppToken = artifacts.require("./AnythingAppToken.sol");
var AnythingAppTokenICO = artifacts.require("./AnythingAppTokenICO.sol");
var EthPriceProvider = artifacts.require("./EthPriceProvider.sol");
var InvestorWhiteList = artifacts.require("./InvestorWhiteList.sol");

module.exports = async function(deployer) {
  await deployer.deploy(SafeMath);
  deployer.link(SafeMath, AnythingAppToken);
  deployer.link(SafeMath, AnythingAppTokenICO);
  await deployer.deploy(AnythingAppToken).then(async function() {
    const token = AnythingAppToken.address;
    const totalTokens = 8700000; //NOT in wei, converted by contract
    const beneficiary = web3.eth.accounts[0];
    const baseEthUsdPrice = 50000; //in cents
    const ethPriceProvider = web3.eth.accounts[8];
    const tokenMinimalPurchase = 10000;
    const tokenPriceUsd = 100; //in cents
    const startTime = (await web3.eth.getBlock(await web3.eth.blockNumber)).timestamp;
    const endTime = startTime + 3600*24;
    await deployer.deploy(InvestorWhiteList);
    await deployer.deploy(AnythingAppTokenICO, 
      token,
      beneficiary,
      InvestorWhiteList.address,

      totalTokens,
      tokenPriceUsd,

      baseEthUsdPrice,

      // bonus levels
      500,
      1000,

      startTime,
      endTime
    );
    await deployer.deploy(EthPriceProvider);

    const preSaleInstance = await web3.eth.contract(AnythingAppTokenICO.abi).at(AnythingAppTokenICO.address);
    const ethProvider = await web3.eth.contract(EthPriceProvider.abi).at(EthPriceProvider.address);

    await preSaleInstance.setEthPriceProvider(EthPriceProvider.address, { from: web3.eth.accounts[0] });
    await ethProvider.setWatcher(AnythingAppTokenICO.address, { from: web3.eth.accounts[0] });

    //start update and send ETH to cover Oraclize fees
    await ethProvider.startUpdate(30000, { value: web3.toWei(1000), from: web3.eth.accounts[0], gas: 200000 });
  });
};
