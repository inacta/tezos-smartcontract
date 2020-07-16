const fa2_basic = artifacts.require('fa2_basic');
const { alice, bob } = require('./../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('./../helpers/saveContractAddress');

// Set initial storage which is a parameter to the deployment
// operation
const initial_account = {balance: 10, allowances: []};
const initial_ledger = MichelsonMap.fromLiteral({
    [`${alice.pkh}`]: initial_account,
    [`${bob.pkh}`]: initial_account
});
const asset_description = {
    token_id: 0,
    symbol: "CVL0",
    name: "Crypto Valley Labs, iteration 0",
    decimals: 6,
    extras: MichelsonMap.fromLiteral({})
};
// I think the type of the key of all big_maps has to be string
const token_metadata = MichelsonMap.fromLiteral({
    [`0`]: asset_description
 });
const initial_storage = {
    ledger: initial_ledger,
    token_metadata: token_metadata
};

module.exports = async (deployer, network, accounts) => {

    // TODO format to await instead of .then
    deployer.deploy(fa2_basic, initial_storage)
        .then(contract => saveContractAddress('tzip12', contract.address));

};
module.exports.initial_storage = initial_storage;
