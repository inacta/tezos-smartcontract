const fa2_pwl = artifacts.require('fa2_with_particular_whitelisting');
const fa2_uwl = artifacts.require('fa2_with_universal_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');
const constants = require('../../helpers/fa2Constants.js');
const { expectThrow } = require('./../shared_utils.js');
const initial_storage = require('./../../helpers/storage');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

contract('fa2_pwl + fa2_uwl', (_accounts) => {
    let storages = [];
    let fa2_instances = [];
    let contract_names = [];
    let wrapper_storage;
    let fa2_wl_wrapper_instance;

    before(async () => {
        fa2_instances[0] = await fa2_pwl.new(initial_storage.initial_storage_fa2_pwl);
        fa2_instances[1] = await fa2_uwl.new(initial_storage.initial_storage_fa2_uwl);
        fa2_wl_wrapper_instance = await fa2_wl_wrapper.new(initial_storage.initial_storage_fa2_wl_wrapper);
        contract_names[0] = "FA2 with particular whitelisting";
        contract_names[1] = "FA2 with universal whitelisting";

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA2 PWL deployed at:', fa2_instances[0].address);
        console.log('FA2 UWL deployed at:', fa2_instances[1].address);
        console.log(
            'Wrapper contract deployed at:',
            fa2_wl_wrapper_instance.address
        );
        storages[0] = await fa2_instances[0].storage();
        storages[1] = await fa2_instances[1].storage();
        wrapper_storage = await fa2_wl_wrapper_instance.storage();
    });

    describe('balance_of', () => {
        it('balance_of should fail for non-registered assets', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];

                // call with empty request to clear storage of wrapper contract
                requests = [];
                await fa2_wl_wrapper_instance.call_balance_of(
                    instance.address,
                    requests
                );
                var wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.balance_responses.length,
                    0,
                    'balance responses entry should be empty before call, ' + name
                );

                var requests = requests = [{ owner: alice.pkh, token_id: 2 }];
                await expectThrow(
                    fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    ),
                    constants.contractErrors.unknownTokenId
                );
                wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.balance_responses.length,
                    0,
                    'balance responses should be empty after failed call, ' + name
                );

                // succeed when token_id is known
                requests = [{ owner: alice.pkh, token_id: 1 }];
                await fa2_wl_wrapper_instance.call_balance_of(
                    instance.address,
                    requests
                );
                wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.balance_responses.length,
                    1,
                    'balance responses should be non-empty after successful call, ' + name
                );

                // call with empty request to clear storage of wrapper contract
                requests = [];
                await fa2_wl_wrapper_instance.call_balance_of(
                    instance.address,
                    requests
                );
                wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.balance_responses.length,
                    0,
                    'balance responses must be empty after empty list used in call, ' + name
                );
            }
        });

        it('balance_of should respond with expected balances for token_id = 0 and token_id = 1, ', async () => {
            assert.equal(
                wrapper_storage.balance_responses.length,
                0,
                'balance responses entry should be empty before call, '
            );

            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];

                // Make method call to balance_of endpoint and verify that the correct balances are returned to the caller smart contract
                var requests = [];
                await fa2_wl_wrapper_instance.call_balance_of(
                    instance.address,
                    requests
                );
                wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.balance_responses.length,
                    0,
                    'balance responses entry should be empty after call with no requests, ' + name
                );
                for (token_id = 0; token_id < 2; token_id++) {
                    // Verify Alice's balance
                    requests = [{ owner: alice.pkh, token_id }];
                    await fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    );
                    wrapper_storage = await fa2_wl_wrapper_instance.storage();
                    assert.equal(
                        wrapper_storage.balance_responses[0].balance,
                        10,
                        "Alice's initial balance is unchanged, " + name
                    );

                    // Verify Bob's balance
                    requests[0].owner = bob.pkh;
                    await fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    );
                    wrapper_storage = await fa2_wl_wrapper_instance.storage();
                    assert.equal(
                        wrapper_storage.balance_responses[0].balance,
                        10,
                        "Bob's initial balance is unchanged, " + name
                    );

                    // Verify Charlie's balance
                    requests[0].owner = charlie.pkh;
                    await fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    );
                    wrapper_storage = await fa2_wl_wrapper_instance.storage();
                    assert.equal(
                        wrapper_storage.balance_responses[0].balance,
                        0,
                        "Charlie's initial balance is uninitialized and must thus be 0, " + name
                    );

                    // Verify David's balance
                    requests[0].owner = david.pkh;
                    await fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    );
                    wrapper_storage = await fa2_wl_wrapper_instance.storage();
                    assert.equal(
                        wrapper_storage.balance_responses[0].balance,
                        token_id === 0 ? 2 : 0,
                        "David's initial balance is unchanged, " + name
                    );

                    requests = [
                        { owner: alice.pkh, token_id },
                        { owner: bob.pkh, token_id },
                    ];
                    await fa2_wl_wrapper_instance.call_balance_of(
                        instance.address,
                        requests
                    );
                    wrapper_storage = await fa2_wl_wrapper_instance.storage();
                    assert.equal(
                        wrapper_storage.balance_responses.length,
                        2,
                        'Can request multiple balances, ' + name
                    );
                    assert(
                        wrapper_storage.balance_responses
                            .map((x) => x.request.owner)
                            .includes(alice.pkh)
                    );
                    assert(
                        wrapper_storage.balance_responses
                            .map((x) => x.request.owner)
                            .includes(bob.pkh)
                    );
                }
            }
        });
    });
});
