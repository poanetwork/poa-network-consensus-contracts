pragma solidity ^0.4.24;


interface IVotingTo {
    function finalize(uint256) external;
}


contract VotingKey {
	IVotingTo public votingTo;

    constructor(address _votingTo) public {
    	votingTo = IVotingTo(_votingTo);
    }

    function callFinalize(uint256 _id) public {
    	votingTo.finalize(_id);
    }
}