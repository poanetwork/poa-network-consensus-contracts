pragma solidity ^0.4.24;

import "./interfaces/IEmissionFunds.sol";


contract EmissionFunds is IEmissionFunds {
    address public votingToManageEmissionFunds;

    event FundsSentTo(
        address indexed receiver,
        address indexed caller,
        uint256 amount,
        bool indexed success
    );
    
    event FundsBurnt(
        address indexed burner,
        uint256 amount,
        bool indexed success
    );

    modifier onlyVotingToManageEmissionFunds() {
        require(msg.sender == votingToManageEmissionFunds);
        _;
    }

    constructor(address _votingToManageEmissionFunds) public {
        require(_votingToManageEmissionFunds != address(0));
        votingToManageEmissionFunds = _votingToManageEmissionFunds;
    }

    function() external payable {} // solhint-disable-line no-empty-blocks

    function sendFundsTo(address _receiver, uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        if (msg.data.length < 32*2 + 4) return false;
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = _receiver.send(_amount);
        emit FundsSentTo(_receiver, msg.sender, _amount, success);
        return success;
    }

    function burnFunds(uint256 _amount)
        external
        onlyVotingToManageEmissionFunds
        returns(bool)
    {
        // using `send` instead of `transfer` to avoid revert on failure
        bool success = address(0).send(_amount);
        emit FundsBurnt(msg.sender, _amount, success);
        return success;
    }
}