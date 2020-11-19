const BigNumber = require('bignumber.js');
const fa1_2_basic = artifacts.require("fa1_2_basic");
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
const fa1_2_burn_mint = artifacts.require("fa1_2_burn_mint");
const fa1_2_kiss = artifacts.require("fa1_2_kiss");
const fa1_2_basic_wrapper = artifacts.require("fa1_2_basic_wrapper");
const initial_storage = require('./../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const constants = require('../../helpers/fa1_2Constants.js');

const {
    expectThrow,
} = require('../shared_utils.js');

contract('fa1_2_basic and fa1_2_with_whitelisting', (_accounts) => {
    let storages = [];
    let fa1_2_instances = [];
    let contract_names = [];
    let fa1_2_basic_wrapper_instance;
    let wrapper_storage;

    before(async () => {
        contract_names[0] = "fa1_2_basic";
        fa1_2_instances[0] = await fa1_2_basic.new(initial_storage.initial_storage_fa1_2_basic);
        contract_names[1] = "fa1_2_with_whitelisting all whitelisted";
        fa1_2_instances[1] = await fa1_2_with_whitelisting.new(initial_storage.initial_storage_fa1_2_with_whitelisting_all_whitelisted);
        contract_names[2] = "fa1_2_burn_mint";
        fa1_2_instances[2] = await fa1_2_burn_mint.new(initial_storage.initial_storage_fa1_2_burn_mint_alice_minter);
        contract_names[3] = "fa1_2_kiss";
        fa1_2_instances[3] = await fa1_2_kiss.new(initial_storage.initial_storage_fa1_2_kiss);
        fa1_2_basic_wrapper_instance = await fa1_2_basic_wrapper.new(initial_storage.initial_storage_fa1_2_wrapper);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_instances[0].address);
        console.log('FA1.2-WL contract deployed at:', fa1_2_instances[1].address);
        console.log('FA1.2 burn/mint:', fa1_2_instances[2].address);
        console.log('FA1.2 kiss:', fa1_2_instances[3].address);
        console.log('FA1.2-wrapper contract deployed at:', fa1_2_basic_wrapper_instance.address);
        storages[0] = await fa1_2_instances[0].storage();
        storages[1] = await fa1_2_instances[1].storage();
        storages[2] = await fa1_2_instances[2].storage();
        storages[3] = await fa1_2_instances[3].storage();
        wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
    });

    describe('get_balance', () => {
        it('should respond with expected balances', async () => {
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                'balance responses entry should be zero before call, '
            );

            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    alice.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                const initial_balance = name === 'fa1_2_kiss' ? 120 : 10;
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(initial_balance)),
                    `Alice's initial balance is ${initial_balance}}, ` + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    bob.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(10)),
                    "Bob's initial balance is 10, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                    "Charlie's initial balance is 0, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    david.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                    "David's initial balance is 2, " + name
                );

                // Make a transfer and verify that balances are updated correctly
                await instance.transfer(alice.pkh, bob.pkh, 7);
                await fa1_2_basic_wrapper_instance.call_get_balance(
                    alice.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                let new_balance = name === 'fa1_2_kiss' ? 113 : 3;
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(new_balance)),
                    `Alice's new balance is ${new_balance}, ` + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    bob.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(17)),
                    "Bob's new balance is 17, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                    "Charlie's new balance is 0, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    david.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                    "David's new balance is 2, " + name
                );

                // Make a transfer to an address with 0 balance (and without an account
                // in storage) and verify that balances are reported correctly after this
                await instance.transfer(alice.pkh, charlie.pkh, 2);
                await fa1_2_basic_wrapper_instance.call_get_balance(
                    alice.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                new_balance = name === 'fa1_2_kiss' ? 111 : 1;
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(new_balance)),
                    `Alice's new balance is ${new_balance}, ` + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    bob.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(17)),
                    "Bob's balance is still 17, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                    "Charlie's new balance is 2, " + name
                );

                await fa1_2_basic_wrapper_instance.call_get_balance(
                    david.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                    "David's balance is still 2, " + name
                );
            }
        });
    });
});
