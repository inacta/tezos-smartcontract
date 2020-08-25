const fa1_2_basic = artifacts.require('fa1_2_basic');
const { alice, bob, charlie, david } = require('../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('../helpers/saveContractAddress');

// Set initial storage which is a parameter to the deployment
// operation
const initial_account = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
const initial_ledger = MichelsonMap.fromLiteral({
    [`${alice.pkh}`]: initial_account,
    [`${bob.pkh}`]: initial_account,
    [`${david.pkh}`]: initial_account_david,
});
const initial_storage = {
    ledger: initial_ledger,
    total_supply: 22,
};

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa1_2_basic, initial_storage)
        .then((contract) => saveContractAddress('tzip7', contract.address));
};
module.exports.initial_storage = initial_storage;
