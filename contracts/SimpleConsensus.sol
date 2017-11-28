contract SimpleConsensus {
    /// Issue this log event to signal a desired change in validator set.
    /// This will not lead to a change in active validator set until 
    /// finalizeChange is called.
    ///
    /// Only the last log event of any block can take effect.
    /// If a signal is issued while another is being finalized it may never
    /// take effect.
    /// 
    /// _parent_hash here should be the parent block hash, or the
    /// signal will not be recognized.
    struct ValidatorState {
		// Is this a validator.
		bool isValidator;
		// Index in the currentValidators.
		uint256 index;
	}

	bool public finalized = false;
	address public SYSTEM_ADDRESS = 0xfffffffffffffffffffffffffffffffffffffffe;
    address[] public currentValidators;
    address[] public pendingList;
    address public keysManager;
    address public ballotsManager;
    uint256 public currentValidatorsLength;
    mapping(address => ValidatorState) public validatorsState;


	modifier only_system_and_not_finalized() {
		require(msg.sender == SYSTEM_ADDRESS && !finalized);
		_;
	}

    modifier only_ballots_manager_or_keys_manager() {
        require(msg.sender == ballotsManager || msg.sender == keysManager);
        _;
    }

    modifier only_ballots_manager() {
        require(msg.sender == ballotsManager);
        _;
    }

    modifier is_validator(address _someone) {
        require(validatorsState[_someone].isValidator);
        _;
    }

    modifier is_not_validator(address _someone) {
        require(!validatorsState[_someone].isValidator);
        _;
    }


    event InitiateChange(bytes32 indexed _parent_hash, address[] _new_set);
    event ChangeFinalized(address[] _new_set);
    
    function SimpleConsensus() {
        // TODO: When you deploy this contract, make sure you hardcode items below
        // Make sure you have those addresses defined in spec.json
        currentValidators = [0x0039F22efB07A647557C7C5d17854CFD6D489eF3];
        for(uint256 i = 0; i < currentValidators.length; i++){
            validatorsState[currentValidators[i]] = ValidatorState({
                isValidator: true,
                index: i
            });
        }
        currentValidatorsLength = currentValidators.length;
        pendingList = currentValidators;
        keysManager = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
        ballotsManager = 0x0039F22efB07A647557C7C5d17854CFD6D489eF3;
    }
    /// Get current validator set (last enacted or initial if no changes ever made)
    function getValidators() public view returns (address[]) {
        return currentValidators;        
    }
    
    /// Called when an initiated change reaches finality and is activated. 
    /// Only valid when msg.sender == SUPER_USER (EIP96, 2**160 - 2)
    ///
    /// Also called when the contract is first enabled for consensus. In this case,
    /// the "change" finalized is the activation of the initial set.
    
	function finalizeChange() public only_system_and_not_finalized {
		finalized = true;
		currentValidators = pendingList;
        currentValidatorsLength = currentValidators.length;
		ChangeFinalized(getValidators());
	}
	
    
    function addValidator(address _validator) public only_ballots_manager_or_keys_manager is_not_validator(_validator) {
        require(_validator != address(0));
        pendingList = currentValidators;
        pendingList.push(_validator);
        validatorsState[_validator] = ValidatorState({
            isValidator: true,
            index: currentValidators.length
        });
        finalized = false;
        InitiateChange(block.blockhash(block.number - 1), pendingList);
    }

    function removeValidator(address _validator) public only_ballots_manager_or_keys_manager is_validator(_validator) {
        uint removedIndex = validatorsState[_validator].index;
		// Can not remove the last validator.
		uint lastIndex = pendingList.length-1;
		address lastValidator = pendingList[lastIndex];
		// Override the removed validator with the last one.
		pendingList[removedIndex] = lastValidator;
		// Update the index of the last validator.
		validatorsState[lastValidator].index = removedIndex;
		delete pendingList[lastIndex];
        pendingList.length--;
        validatorsState[_validator].index = 0;
		validatorsState[_validator].isValidator = false;
        finalized = false;
        InitiateChange(block.blockhash(block.number - 1), pendingList);
    }

    function setKeysManager(address _newAddress) public only_ballots_manager {
        require(_newAddress != ballotsManager);
        keysManager = _newAddress;
    }

    function setBallotsManager(address _newAddress) public only_ballots_manager {
        ballotsManager = _newAddress;
    }
    
}