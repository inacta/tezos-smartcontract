const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');

contract('fa2_wl', (_accounts) => {
    let storage;
    let wrapper_storage;
    let fa2_wl_instance;
    let fa2_wl_wrapper_instance;

    before(async () => {
        fa2_wl_instance = await fa2_wl.deployed();
        fa2_wl_wrapper_instance = await fa2_wl_wrapper.deployed();

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('Contract deployed at:', fa2_wl_instance.address);
        console.log(
            'Wrapper contract deployed at:',
            fa2_wl_wrapper_instance.address
        );
        storage = await fa2_wl_instance.storage();
        wrapper_storage = await fa2_wl_wrapper_instance.storage();
    });

    describe('balance_of', () => {
        it('balance_of should respond with expected balances', async () => {
            assert.equal(
                wrapper_storage.balance_responses.length,
                0,
                'balance responses entry should be empty before call'
            );

            // Make method call to balance_of endpoint and verify that the correct balances are returned to the caller smart contract
            var requests = [];
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses.length,
                0,
                'balance responses entry should be empty after call with no requests'
            );

            // Verify Alice's balance
            requests = [{ owner: alice.pkh, token_id: 0 }];
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses[0].balance,
                10,
                "Alice's initial balance is unchanged"
            );

            // Verify Bob's balance
            requests[0].owner = bob.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses[0].balance,
                10,
                "Bob's initial balance is unchanged"
            );

            // Verify Charlie's balance
            requests[0].owner = charlie.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses[0].balance,
                0,
                "Charlie's initial balance is uninitialized and must thus be 0"
            );

            // Verify David's balance
            requests[0].owner = david.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses[0].balance,
                2,
                "David's initial balance is unchanged"
            );

            requests = [
                { owner: alice.pkh, token_id: 0 },
                { owner: bob.pkh, token_id: 0 },
            ];
            await fa2_wl_wrapper_instance.call_balance_of(
                fa2_wl_instance.address,
                requests
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.balance_responses.length,
                2,
                'Can request multiple balances'
            );
            expect(
                wrapper_storage.balance_responses
                    .map((x) => x.request.owner)
                    .includes(alice.pkh)
            ).to.be.true;
            expect(
                wrapper_storage.balance_responses
                    .map((x) => x.request.owner)
                    .includes(bob.pkh)
            ).to.be.true;
        });
    });
});
