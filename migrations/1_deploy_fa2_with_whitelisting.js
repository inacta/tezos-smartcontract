const fa2_wl = artifacts.require('fa2_with_whitelisting');
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('./../helpers/saveContractAddress');

// Set initial storage which is a parameter to the deployment
// operation
const initial_account = {balance: 10, allowances: []};
const initial_account_david = { balance: 2, allowances: [alice.pkh] };
const initial_ledger = MichelsonMap.fromLiteral({
    [`${alice.pkh}`]: initial_account,
    [`${bob.pkh}`]: initial_account,
    [`${david.pkh}`]: initial_account_david
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
    token_metadata: token_metadata,
    whitelisteds: [],
    whitelisters: [],
    whitelist_admins: [alice.pkh],
    non_revocable_whitelist_admin: alice.pkh
};

module.exports = async (deployer, network, accounts) => {

    // TODO format to await instead of .then
    deployer.deploy(fa2_wl, initial_storage)
        .then(contract => saveContractAddress('tzip12', contract.address));

};
module.exports.initial_storage = initial_storage;
