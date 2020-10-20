const BigNumber = require('bignumber.js');
const { MichelsonMap } = require('@taquito/taquito');
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');

{
    const initial_storage_fa1_2_wrapper = {
        allowance_response: 0n,
        balance_response: 0n,
        total_supply_response: 0n,
    };

    module.exports.initial_storage_fa1_2_wrapper = initial_storage_fa1_2_wrapper;
}

// Set initial storage which is a parameter to the deployment
// operation
{
    const initial_account_alice = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}) };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_basic = {
        ledger: initial_ledger,
        total_supply: 22,
    };

    module.exports.initial_storage_fa1_2_basic = initial_storage_fa1_2_basic;
}

{
    const initial_account_alice = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}) };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_burn_mint_alice_minter = {
        ledger: initial_ledger,
        total_supply: 22,
        minter: alice.pkh,
    };

    module.exports.initial_storage_fa1_2_burn_mint_alice_minter = initial_storage_fa1_2_burn_mint_alice_minter;
}

{
    const initial_account_alice = { balance: 120, allowances: MichelsonMap.fromLiteral({}), debit: 0 };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}), debit: 0 };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}), debit: 0 };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_kiss = {
        admin: alice.pkh,
        ledger: initial_ledger,
        total_supply: 132,
        nonces: MichelsonMap.fromLiteral({}),
        signed_claims: [], // TODO: Remove
        allowed_activities: MichelsonMap.fromLiteral({
             [`0`]: true,
             [`1`]: true,
             [`2`]: true,
         }),
    };

    module.exports.initial_storage_fa1_2_kiss = initial_storage_fa1_2_kiss;
}

{
    const activity_balance = MichelsonMap.fromLiteral({
        [`0`]: new BigNumber(0),
        [`1`]: new BigNumber(0),
        [`2`]: new BigNumber(0),
    });
    const allowed_activities = MichelsonMap.fromLiteral({
        [`0`]: true,
        [`1`]: true,
        [`2`]: true,
    });
    const initial_storage_fa1_2_kiss_activity_log = {
        activity_balance: activity_balance,
        allowed_activities: allowed_activities,
    };

    module.exports.initial_storage_fa1_2_kiss_activity_log = initial_storage_fa1_2_kiss_activity_log;
}

{
    const initial_account_alice = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}) };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_burn_mint_bob_minter = {
        ledger: initial_ledger,
        total_supply: 22,
        minter: bob.pkh,
    };

    module.exports.initial_storage_fa1_2_burn_mint_bob_minter = initial_storage_fa1_2_burn_mint_bob_minter;
}

{
    const initial_account_alice = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}) };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_with_whitelisting_all_whitelisted = {
        ledger: initial_ledger,
        total_supply: 22,
        whitelisteds: [alice.pkh, bob.pkh, charlie.pkh, david.pkh],
        whitelisters: [],
        whitelist_admins: [alice.pkh],
        non_revocable_whitelist_admin: alice.pkh,
    };

    module.exports.initial_storage_fa1_2_with_whitelisting_all_whitelisted = initial_storage_fa1_2_with_whitelisting_all_whitelisted;
}

{
    const initial_account_alice = { balance: 10, allowances: MichelsonMap.fromLiteral({}) };
    const initial_account_bob = { balance: 10, allowances: MichelsonMap.fromLiteral({[`${alice.pkh}`]: 8}) };
    const initial_account_david = { balance: 2, allowances: MichelsonMap.fromLiteral({}) };
    const initial_ledger = MichelsonMap.fromLiteral({
        [`${alice.pkh}`]: initial_account_alice,
        [`${bob.pkh}`]: initial_account_bob,
        [`${david.pkh}`]: initial_account_david,
    });
    const initial_storage_fa1_2_with_whitelisting_no_whitelisted = {
        ledger: initial_ledger,
        total_supply: 22,
        whitelisteds: [],
        whitelisters: [],
        whitelist_admins: [alice.pkh],
        non_revocable_whitelist_admin: alice.pkh,
    };

    module.exports.initial_storage_fa1_2_with_whitelisting_no_whitelisted = initial_storage_fa1_2_with_whitelisting_no_whitelisted;
}

{
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
    const empty_whitelisteds = MichelsonMap.fromLiteral({});
    const initial_storage_fa2_pwl = {
        ledger: initial_ledger,
        token_metadata: token_metadata,
        whitelisteds: empty_whitelisteds,
        whitelisters: [],
        whitelist_admins: [alice.pkh],
        non_revocable_whitelist_admin: alice.pkh,
    };

    module.exports.initial_storage_fa2_pwl = initial_storage_fa2_pwl;
}

{
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
    const initial_storage_fa2_uwl = {
        ledger: initial_ledger,
        token_metadata: token_metadata,
        whitelisteds: [],
        whitelisters: [],
        whitelist_admins: [alice.pkh],
        non_revocable_whitelist_admin: alice.pkh,
    };

    module.exports.initial_storage_fa2_uwl = initial_storage_fa2_uwl;
}

{
    const initial_storage_fa2_wl_wrapper = {
        tmr_response: bob.pkh,
        balance_responses: [],
    };
    module.exports.initial_storage_fa2_wl_wrapper = initial_storage_fa2_wl_wrapper;
}
