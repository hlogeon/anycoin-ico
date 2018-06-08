pragma solidity ^0.4.11;

import "./Haltable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./AnythingAppToken.sol";
import "./InvestorWhiteList.sol";
import "./abstract/PriceReceiver.sol";


contract AnythingAppTokenPreSale is Haltable, PriceReceiver {
  using SafeMath for uint;

  string public constant name = "AnythingAppTokenPreSale";

  AnythingAppToken public token;
  InvestorWhiteList public investorWhiteList;
  address public beneficiary;

  uint public tokenPriceUsd;
  uint public totalTokens;//in wei

  uint public ethUsdRate;

  uint public collected = 0;
  uint public withdrawn = 0;
  uint public tokensSold = 0;
  uint public investorCount = 0;
  uint public weiRefunded = 0;

  uint public startTime;
  uint public endTime;

  bool public crowdsaleFinished = false;

  mapping (address => bool) public refunded;
  mapping (address => uint) public deposited;

  uint public constant BONUS_LEVEL_1 = 40;
  uint public constant BONUS_LEVEL_2 = 35;
  uint public constant BONUS_LEVEL_3 = 30;

  uint public firstStage;
  uint public secondStage;
  uint public thirdStage;

  uint public constant MINIMAL_PURCHASE = 250 ether;
  uint public constant LIMIT_PER_USER = 500000 ether;

  event NewContribution(address indexed holder, uint tokenAmount, uint etherAmount);
  event NewReferralTransfer(address indexed investor, address indexed referral, uint tokenAmount);
  event Refunded(address indexed holder, uint amount);
  event Deposited(address indexed holder, uint amount);

  modifier preSaleActive() {
    require(block.timestamp >= startTime && block.timestamp < endTime);
    _;
  }

  modifier preSaleEnded() {
    require(block.timestamp >= endTime);
    _;
  }

  modifier inWhiteList() {
    require(investorWhiteList.isAllowed(msg.sender));
    _;
  }

  function AnythingAppTokenPreSale(
    address _token,
    address _beneficiary,
    address _investorWhiteList,

    uint _totalTokens,
    uint _tokenPriceUsd,

    uint _baseEthUsdPrice,

    uint _firstStage,
    uint _secondStage,
    uint _thirdStage,

    uint _startTime,
    uint _endTime
  ) {
    ethUsdRate = _baseEthUsdPrice;
    tokenPriceUsd = _tokenPriceUsd;

    totalTokens = _totalTokens.mul(1 ether);

    token = AnythingAppToken(_token);
    investorWhiteList = InvestorWhiteList(_investorWhiteList);
    beneficiary = _beneficiary;

    firstStage = _firstStage.mul(1 ether);
    secondStage = _secondStage.mul(1 ether);
    thirdStage = _thirdStage.mul(1 ether);

    startTime = _startTime;
    endTime = _endTime;
  }

  function() payable inWhiteList {
    doPurchase(msg.sender);
  }

  function tokenFallback(address _from, uint _value, bytes _data) public pure { }

  function doPurchase(address _owner) private preSaleActive inNormalState {
    if (token.balanceOf(msg.sender) == 0) investorCount++;

    uint tokens = msg.value.mul(ethUsdRate).div(tokenPriceUsd);
    address referral = investorWhiteList.getReferralOf(msg.sender);
    uint referralBonus = calculateReferralBonus(tokens);
    uint bonus = calculateBonus(tokens, referral);

    tokens = tokens.add(bonus);

    uint newTokensSold = tokensSold.add(tokens);
    if (referralBonus > 0 && referral != 0x0) {
      newTokensSold = newTokensSold.add(referralBonus);
    }

    require(newTokensSold <= totalTokens);
    require(token.balanceOf(msg.sender).add(tokens) <= LIMIT_PER_USER);

    tokensSold = newTokensSold;

    collected = collected.add(msg.value);
    deposited[msg.sender] = deposited[msg.sender].add(msg.value);

    token.transfer(msg.sender, tokens);
    NewContribution(_owner, tokens, msg.value);

    if (referralBonus > 0 && referral != 0x0) {
      token.transfer(referral, referralBonus);
      NewReferralTransfer(msg.sender, referral, referralBonus);
    }
  }

  function calculateBonus(uint _tokens, address _referral) private returns (uint _bonuses) {
    uint bonus;

    if (tokensSold < firstStage) {
      bonus = BONUS_LEVEL_1;
    } else if (tokensSold >= firstStage && tokensSold < secondStage) {
      bonus = BONUS_LEVEL_2;
    } else {
      bonus = BONUS_LEVEL_3;
    }

    if (_referral != 0x0) {
      bonus += 5;
    }

    return _tokens.mul(bonus).div(100);
  }

  function calculateReferralBonus(uint _tokens) internal constant returns (uint _bonus) {
    return _tokens.mul(20).div(100);
  }

  function withdraw() external onlyOwner {
    uint withdrawLimit = 500 ether;
    if (withdrawn < withdrawLimit) {
      uint toWithdraw = collected.sub(withdrawn);
      if (toWithdraw + withdrawn > withdrawLimit) {
        toWithdraw = withdrawLimit.sub(withdrawn);
      }
      beneficiary.transfer(toWithdraw);
      withdrawn = withdrawn.add(toWithdraw);
      return;
    }
    require(block.timestamp >= endTime);
    beneficiary.transfer(collected);
    token.transfer(beneficiary, token.balanceOf(this));
    crowdsaleFinished = true;
  }

  function refund() external preSaleEnded inNormalState {
    require(refunded[msg.sender] == false);

    uint refund = deposited[msg.sender];
    require(refund > 0);

    deposited[msg.sender] = 0;
    refunded[msg.sender] = true;
    weiRefunded = weiRefunded.add(refund);
    msg.sender.transfer(refund);
    Refunded(msg.sender, refund);
  }

  function receiveEthPrice(uint ethUsdPrice) external onlyEthPriceProvider {
    require(ethUsdPrice > 0);
    ethUsdRate = ethUsdPrice;
  }

  function setEthPriceProvider(address provider) external onlyOwner {
    require(provider != 0x0);
    ethPriceProvider = provider;
  }

  function setNewWhiteList(address newWhiteList) external onlyOwner {
    require(newWhiteList != 0x0);
    investorWhiteList = InvestorWhiteList(newWhiteList);
  }
}
