const fa2_wl = artifacts.require('fa2_with_whitelisting');
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('./../helpers/saveContractAddress');

// Set initial storage which is a parameter to the deployment
// operation
const positive_balance_ten = MichelsonMap.fromLiteral({
    [`0`]: 10,
    [`1`]: 10,
});
const positive_balance_two = MichelsonMap.fromLiteral({
    [`0`]: 2
});

const initial_account = { balances: positive_balance_ten, allowances: [] };
const initial_account_david = { balances: positive_balance_two, allowances: [alice.pkh] };
const initial_ledger = MichelsonMap.fromLiteral({
    [`${alice.pkh}`]: initial_account,
    [`${bob.pkh}`]: initial_account,
    [`${david.pkh}`]: initial_account_david,
});
const asset_description_0 = {
    token_id: 0,
    symbol: 'CVL0',
    name: 'Crypto Valley Labs, iteration 0',
    decimals: 6,
    extras: MichelsonMap.fromLiteral({}),
};
const asset_description_1 = {
    token_id: 1,
    symbol: 'CVL1',
    name: 'Crypto Valley Labs, iteration 1',
    decimals: 12,
    extras: MichelsonMap.fromLiteral({}),
};
// I think the type of the key of all big_maps has to be string
const token_metadata = MichelsonMap.fromLiteral({
    [`0`]: asset_description_0,
    [`1`]: asset_description_1,
});
const initial_storage = {
    ledger: initial_ledger,
    token_metadata: token_metadata,
    whitelisteds: [],
    whitelisters: [],
    whitelist_admins: [alice.pkh],
    non_revocable_whitelist_admin: alice.pkh,
};

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa2_wl, initial_storage)
        .then((contract) => saveContractAddress('tzip12', contract.address));
};
module.exports.initial_storage = initial_storage;
