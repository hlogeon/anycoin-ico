pragma solidity ^0.4.11;

import "./Burnable.sol";
import "./abstract/ERC223ReceivingContract.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title AnythingAppToken
 *
 * @dev Burnable Ownable ERC20 token
 */
contract AnythingAppToken is Burnable, Ownable {

  string public constant name = "AnythingApp Token";
  string public constant symbol = "ANY";
  uint8 public constant decimals = 18;
  uint public constant INITIAL_SUPPLY = 400000000 * 1 ether;

  /* The finalizer contract that allows unlift the transfer limits on this token */
  address public releaseAgent;

  /** A crowdsale contract can release us to the wild if ICO success. If false we are are in transfer lock up period.*/
  bool public released = false;

  /** Map of agents that are allowed to transfer tokens regardless of the lock down period. These are crowdsale contracts and possible the team multisig itself. */
  mapping (address => bool) public transferAgents;

  event Transfer(address indexed from, address indexed to, uint value, bytes data);

  /**
   * Limit token transfer until the crowdsale is over.
   *
   */
  modifier canTransfer(address _sender) {
    require(released || transferAgents[_sender]);
    _;
  }

  /** The function can be called only before or after the tokens have been released */
  modifier inReleaseState(bool releaseState) {
    require(releaseState == released);
    _;
  }

  /** The function can be called only by a whitelisted release agent. */
  modifier onlyReleaseAgent() {
    require(msg.sender == releaseAgent);
    _;
  }


  /**
   * @dev Constructor that gives msg.sender all of existing tokens.
   */
  function AnythingAppToken() {
    totalSupply = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
    Transfer(0x0, msg.sender, INITIAL_SUPPLY);
  }

  /**
   * Set the contract that can call release and make the token transferable.
   *
   * Design choice. Allow reset the release agent to fix fat finger mistakes.
   */
  function setReleaseAgent(address addr) onlyOwner inReleaseState(false) public {
    require(addr != 0x0);

    // We don't do interface check here as we might want to a normal wallet address to act as a release agent
    releaseAgent = addr;
  }

  function release() onlyReleaseAgent inReleaseState(false) public {
    released = true;
  }

  /**
   * Owner can allow a particular address (a crowdsale contract) to transfer tokens despite the lock up period.
   */
  function setTransferAgent(address addr, bool state) onlyOwner inReleaseState(false) public {
    require(addr != 0x0);
    transferAgents[addr] = state;
  }

  function transferFrom(address _from, address _to, uint _value) canTransfer(_from) returns (bool success) {
    // Call Burnable.transferForm()
    return super.transferFrom(_from, _to, _value);
  }


  /**
     * @dev Transfer the specified amount of tokens to the specified address.
     *      Invokes the `tokenFallback` function if the recipient is a contract.
     *      The token transfer fails if the recipient is a contract
     *      but does not implement the `tokenFallback` function
     *      or the fallback function to receive funds.
     *
     * @param _to    Receiver address.
     * @param _value Amount of tokens that will be transferred.
     * @param _data  Transaction metadata.
     */
    function transfer(address _to, uint _value, bytes _data) canTransfer(msg.sender) returns (bool success) {
      require(_to != address(0));
      require(_value <= balances[msg.sender]);
      uint codeLength;
      assembly {
          codeLength := extcodesize(_to)
      }
      balances[msg.sender] = balances[msg.sender].sub(_value);
      balances[_to] = balances[_to].add(_value);
      if(codeLength>0) {
          ERC223ReceivingContract receiver = ERC223ReceivingContract(_to);
          receiver.tokenFallback(msg.sender, _value, _data);
      }
      Transfer(msg.sender, _to, _value, _data);
      return true;
    }

    /**
     * @dev Transfer the specified amount of tokens to the specified address.
     *      This function works the same with the previous one
     *      but doesn't contain `_data` param.
     *      Added due to backwards compatibility reasons.
     *
     * @param _to    Receiver address.
     * @param _value Amount of tokens that will be transferred.
     */
    function transfer(address _to, uint _value) canTransfer(msg.sender) returns (bool success) {
      require(_to != address(0));
      require(_value <= balances[msg.sender]);

      uint codeLength;
      bytes memory empty;

      assembly {
          codeLength := extcodesize(_to)
      }

      balances[msg.sender] = balances[msg.sender].sub(_value);
      balances[_to] = balances[_to].add(_value);
      if(codeLength>0) {
          ERC223ReceivingContract receiver = ERC223ReceivingContract(_to);
          receiver.tokenFallback(msg.sender, _value, empty);
      }
      Transfer(msg.sender, _to, _value, empty);
      return true;
    }

  function burn(uint _value) onlyOwner returns (bool success) {
    return super.burn(_value);
  }

  function burnFrom(address _from, uint _value) onlyOwner returns (bool success) {
    return super.burnFrom(_from, _value);
  }
}
