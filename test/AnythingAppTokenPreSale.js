const AnythingAppToken = artifacts.require("AnythingAppToken");
const AnythingAppTokenICO = artifacts.require("AnythingAppTokenPreSale");
const InvestorWhiteList = artifacts.require("InvestorWhiteList");

const assertJump = function(error) {
  assert.isAbove(error.message.search('VM Exception while processing transaction: revert'), -1, 'Invalid opcode error must be returned');
};

const beneficiary = web3.eth.accounts[0];
const baseEthUsdPrice = 50000; //in cents
const ethPriceProvider = web3.eth.accounts[8];
const tokenPriceUsd = 100; //in cents
const totalTokens = 1000; //NOT in wei, converted by contract

async function increaseTimestampBy(seconds) {
  const jsonrpc = '2.0';
  const id = 0;
  const send = (method, params = []) => web3.currentProvider.send({id, jsonrpc, method, params});
  await send('evm_increaseTime', [seconds]);
  await send('evm_mine');
}

contract('AnythingAppTokenPreSale', function (accounts) {
  beforeEach(async function () {
    this.block = await web3.eth.getBlock(await web3.eth.blockNumber);
    this.startTime = this.block.timestamp;
    this.endTime = this.startTime + 3600*24;

    this.whiteList = await InvestorWhiteList.new();
    this.token = await AnythingAppToken.new();
    this.crowdsale = await AnythingAppTokenICO.new(
      this.token.address,
      beneficiary,
      this.whiteList.address,

      totalTokens,
      tokenPriceUsd,

      baseEthUsdPrice,

      // bonus levels
      200,
      300,
      500,

      this.startTime,
      this.endTime
    );

    this.token.setTransferAgent(this.token.address, true);
    this.token.setTransferAgent(this.crowdsale.address, true);
    this.token.setTransferAgent(accounts[0], true);

    await this.crowdsale.setEthPriceProvider(ethPriceProvider);

    //transfer more than totalTokens to test hardcap reach properly
    this.token.transfer(this.crowdsale.address, web3.toWei(totalTokens, "ether"));
  });

  it('should done', async function () {
    assert.equal(true, true);
  });

  // Halt

  it('should allow to halt by owner', async function () {
    await this.crowdsale.halt();

    const halted = await this.crowdsale.halted();

    assert.equal(halted, true);
  });

  it('should not allow to halt by not owner', async function () {
    try {
      await this.crowdsale.halt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to halt if already halted', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.halt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to unhalt by owner', async function () {
    await this.crowdsale.halt();

    await this.crowdsale.unhalt();
    const halted = await this.crowdsale.halted();

    assert.equal(halted, false);
  });

  it('should not allow to unhalt when not halted', async function () {
    try {
      await this.crowdsale.unhalt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to unhalt by not owner', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.unhalt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  // end halt

  // Price provider

  it('should allow to update ETH price by ETH price provider', async function () {
    await this.crowdsale.receiveEthPrice(25000, {from: ethPriceProvider});

    const ethUsdRate = await this.crowdsale.ethUsdRate();

    assert.equal(ethUsdRate, 25000);
  });

  it('should not allow to update ETH price by not ETH price provider', async function () {
    try {
      await this.crowdsale.receiveEthPrice(25000, {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to set ETH price provider by owner', async function () {
    await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[0]});

    const newPriceProvider = await this.crowdsale.ethPriceProvider();

    assert.equal(accounts[2], newPriceProvider);
  });

  it('should not allow to set ETH price provider by not owner', async function () {
    try {
      await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to update eth price with zero value', async function () {
    try {
      await this.crowdsale.receiveEthPrice(0, {from: ethPriceProvider});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  // end price provider

  // whitelist
  it('should not allow to set new whitelist with zero value', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0);
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set new whitelist by not owner', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0, { from: accounts[1] });
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should set new whitelist', async function () {
    const newWhiteList = await InvestorWhiteList.new();
    await this.crowdsale.setNewWhiteList(newWhiteList.address);

    const actual = await this.crowdsale.investorWhiteList();
    assert.equal(newWhiteList.address, actual);
  });
  // end whitelist


  it('should send tokens to purchaser (bonus 40%, 35%, 30%)', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.crowdsale.sendTransaction({value: tokensToAmount(200), from: accounts[2]});

    const balance1 = await this.token.balanceOf(accounts[2]);
    assert.equal(balance1.valueOf(), 280 * 10**18);

    const crowdsaleBalance1 = await this.token.balanceOf(this.crowdsale.address);
    assert.equal(crowdsaleBalance1.valueOf(), (totalTokens - 280) * 10 ** 18);

    const collected1 = await this.crowdsale.collected();
    assert.equal(collected1.valueOf(), tokensToAmount(200));

    const investorCount1 = await this.crowdsale.investorCount();
    assert.equal(investorCount1, 1);

    const tokensSold1 = await this.crowdsale.tokensSold();
    assert.equal(tokensSold1.valueOf(), 280 * 10 ** 18);

    // bonus 35%
    await this.whiteList.addInvestorToWhiteList(accounts[3]);

    await this.crowdsale.sendTransaction({value: tokensToAmount(250), from: accounts[3]});

    const balance2 = await this.token.balanceOf(accounts[3]);
    assert.equal(balance2.valueOf(), 337.5 * 10**18);

    const crowdsaleBalance2 = await this.token.balanceOf(this.crowdsale.address);
    assert.equal(crowdsaleBalance2.valueOf(), (totalTokens - (337.5 + 280)) * 10 ** 18);

    const collected2 = await this.crowdsale.collected();
    assert.equal(collected2.valueOf(), tokensToAmount(200 + 250));

    const investorCount2 = await this.crowdsale.investorCount();
    assert.equal(investorCount2, 2);

    const tokensSold2 = await this.crowdsale.tokensSold();
    assert.equal(tokensSold2.valueOf(), (280 + 337.5) * 10 ** 18);

    // bonus 30%
    await this.whiteList.addInvestorToWhiteList(accounts[4]);

    await this.crowdsale.sendTransaction({value: tokensToAmount(100), from: accounts[4]});

    const balance3 = await this.token.balanceOf(accounts[4]);
    assert.equal(balance3.valueOf(), 130 * 10**18);

    const crowdsaleBalance3 = await this.token.balanceOf(this.crowdsale.address);
    assert.equal(crowdsaleBalance3.valueOf(), (totalTokens - (337.5 + 280 + 130)) * 10 ** 18);

    const collected3 = await this.crowdsale.collected();
    assert.equal(collected3.valueOf(), tokensToAmount(200 + 250 + 100));

    const investorCount3 = await this.crowdsale.investorCount();
    assert.equal(investorCount3, 3);

    const tokensSold3 = await this.crowdsale.tokensSold();
    assert.equal(tokensSold3.valueOf(), (280 + 337.5 + 130) * 10 ** 18);
  });

  it('should not allow purchase when pre sale is halted', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.halt();

    try {
      await this.crowdsale.sendTransaction({value: 0.11 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to exceed purchase limit token per user', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const amount = tokenPriceUsd/baseEthUsdPrice * 358 * 10 ** 18;

    try {
      await this.crowdsale.sendTransaction({value: amount, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to exceed purchase limit token', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const amountTokens = 357;
    const amount = ((tokenPriceUsd * 10 ** 18)/baseEthUsdPrice) * amountTokens;
    await this.crowdsale.sendTransaction({value: amount, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert.equal(balance.valueOf(), 499.8 * 10 ** 18);
  });

  it('should not allow purchase after withdraw', async function () {
    const amount = tokensToAmount(357);

    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({ value: amount, from: accounts[1] });
    await this.crowdsale.sendTransaction({ value: amount, from: accounts[2] });

    increaseTimestampBy(3600*24);

    await this.crowdsale.withdraw();

    try {
      await this.crowdsale.sendTransaction({value: 0.11 * 10 ** 18, from: accounts[3]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to exceed hard cap', async function () {
    const amountTokens = 357;
    const amount = ((tokenPriceUsd * 10 ** 18)/baseEthUsdPrice) * amountTokens;

    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: amount, from: accounts[1]});
    await this.crowdsale.sendTransaction({value:amount, from: accounts[2]});

    try {
      await this.crowdsale.sendTransaction({value: ((tokenPriceUsd * 10 ** 18)/baseEthUsdPrice) * 1, from: accounts[4]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow withdraw only for owner', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.withdraw({from: accounts[1]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow withdraw when presale is not ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[1]});

    try {
      await this.crowdsale.withdraw();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should withdraw - send all not distributed tokens and collected ETH to beneficiary', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[2]});

    const oldBenBalanceEth = await web3.eth.getBalance(beneficiary);
    const oldBenBalanceAny = await this.token.balanceOf(beneficiary);

    increaseTimestampBy(3600*24);

    await this.crowdsale.withdraw();

    const newBenBalanceEth = await web3.eth.getBalance(beneficiary);
    const newBenBalanceAny = await this.token.balanceOf(beneficiary);

    const preSaleContractBalanceAny = await this.token.balanceOf(this.crowdsale.address);
    const preSaleContractBalanceEth = await web3.eth.getBalance(this.crowdsale.address);

    assert.equal(newBenBalanceEth.gt(oldBenBalanceEth), true);
    assert.equal(newBenBalanceAny.gt(oldBenBalanceAny), true);
    assert.equal(preSaleContractBalanceAny, 0);
    assert.equal(preSaleContractBalanceEth, 0);
  });

  it('should not allow purchase if pre sale is ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    increaseTimestampBy(3600*24);

    try {
      await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if pre sale is not ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.refund({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if pre sale is halted', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[1]});

    increaseTimestampBy(3600*24);

    await this.crowdsale.halt();

    try {
      await this.crowdsale.refund({from: accounts[1]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should send 5% referral bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    await this.whiteList.addReferralOf(accounts[2], accounts[3]);

    await this.crowdsale.sendTransaction({
      value: tokensToAmount(50),
      from: accounts[2],
    });

    const balanceOf2 = await this.token.balanceOf(accounts[2]);
    assert.equal(balanceOf2.valueOf(), 72.5 * 10 ** 18); // (50 + 40%) + (50 + 5%)

    const balanceOf3 = await this.token.balanceOf(accounts[3]);
    assert.equal(balanceOf3.valueOf(), 10 * 10 ** 18);
  });

  it('should not add referral bonus to tokensSold if no referral of investor', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({
      value: 0.1 * 10 ** 18,
      from: accounts[2],
    });

    //check that investor received proper tokens count
    const balanceOf2 = await this.token.balanceOf(accounts[2]);
    assert.equal(balanceOf2.valueOf(), 70 * 10 ** 18);

    //check that sender deposit was increased
    const deposited = await this.crowdsale.deposited(accounts[2]);
    assert.equal(deposited.toNumber(), 0.1 * 10 ** 18);

    //check that tokensSold is correct
    const tokensSold = await this.crowdsale.tokensSold();
    assert.equal(tokensSold.toNumber(), 70 * 10 ** 18);
  });
});

function tokensToAmount(amountTokens) {
  const amount = ((tokenPriceUsd * 10 ** 18) / baseEthUsdPrice) * amountTokens;
  return amount;
}

