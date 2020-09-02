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

    describe('get_allowance', () => {
        it('returns expected value', async () => {
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                'allowance resonse should be zero before call'
            );

            // Verify initial value
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                bob.pkh,
                alice.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(8)),
                "Alice can spend 8 from Bob's account"
            );

            // Verify initial value of 0
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                bob.pkh,
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                "Charlie can spend 0 from Bob's account"
            );

            // Verify initial value of 0
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                alice.pkh,
                bob.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                "Bob can spend 0 from Alice's account"
            );

            // Allow Charlie to spend from Alice's account and verify that
            // the value is updated correcly
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                alice.pkh,
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                "Charlie can spend 0 from Alice's account prior to approval"
            );

            await fa1_2_basic_instance.approve(charlie.pkh, 5);
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                alice.pkh,
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(5)),
                "Charlie can spend 5 from Alice's account after approval"
            );

            // Set allowance back to 0 to prevent this from disturbing state
            await fa1_2_basic_instance.approve(charlie.pkh, 0);
            await fa1_2_basic_wrapper_instance.call_get_allowance(
                alice.pkh,
                charlie.pkh,
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                "Charlie can spend 0 from Alice's account after reset of approval"
            );
        });
    });
});
