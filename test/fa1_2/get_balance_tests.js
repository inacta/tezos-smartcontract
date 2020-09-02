const BigNumber = require('bignumber.js');
const fa1_2_basic = artifacts.require("fa1_2_basic");
const fa1_2_basic_wrapper = artifacts.require("fa1_2_basic_wrapper");
const initial_storage = require('./../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const constants = require('../../helpers/fa1_2Constants.js');

const {
    expectThrow,
} = require('../shared_utils.js');

contract('fa1_2_basic', (_accounts) => {
    let storage;
    let wrapper_storage;
    let fa1_2_basic_instance;
    let fa1_2_basic_wrapper_instance;

    before(async () => {
        fa1_2_basic_instance = await fa1_2_basic.new(initial_storage.initial_storage_fa1_2_basic);
        fa1_2_basic_wrapper_instance = await fa1_2_basic_wrapper.new(initial_storage.initial_storage_fa1_2_wrapper);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_basic_instance.address);
        console.log(
            'Wrapper contract deployed at:',
            fa1_2_basic_wrapper_instance.address
        );
        storage = await fa1_2_basic_instance.storage();
        wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
    });

    describe('get_balance', () => {
        it('should respond with expected balances', async () => {
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                'balance responses entry should be zero before call'
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                alice.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(10)),
                "Alice's initial balance is 10"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                bob.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(10)),
                "Bob's initial balance is 10"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                "Charlie's initial balance is 0"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                david.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                "David's initial balance is 2"
            );

            // Make a transfer and verify that balances are updated correctly
            await fa1_2_basic_instance.transfer(alice.pkh, bob.pkh, 7);
            await fa1_2_basic_wrapper_instance.call_get_balance(
                alice.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(3)),
                "Alice's new balance is 3"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                bob.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(17)),
                "Bob's new balance is 17"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(0)),
                "Charlie's new balance is 0"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                david.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                "David's new balance is 2"
            );

            // Make a transfer to an address with 0 balance (and without an account
            // in storage) and verify that balances are reported correctly after this
            await fa1_2_basic_instance.transfer(alice.pkh, charlie.pkh, 2);
            await fa1_2_basic_wrapper_instance.call_get_balance(
                alice.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(1)),
                "Alice's new balance is 1"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                bob.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(17)),
                "Bob's balance is still 17"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                "Charlie's new balance is 2"
            );

            await fa1_2_basic_wrapper_instance.call_get_balance(
                david.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.balance_response.isEqualTo(new BigNumber(2)),
                "David's balance is still 2"
            );
        });
    });
});
