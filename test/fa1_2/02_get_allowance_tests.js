const BigNumber = require('bignumber.js');
const fa1_2_basic = artifacts.require("fa1_2_basic");
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
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
        fa1_2_instances[0] = await fa1_2_basic.new(initial_storage.initial_storage_fa1_2_basic);
        contract_names[0] = "fa1_2_basic";
        contract_names[1] = "fa1_2_with_whitelisting all whitelisted";
        fa1_2_instances[1] = await fa1_2_with_whitelisting.new(initial_storage.initial_storage_fa1_2_with_whitelisting_all_whitelisted);
        fa1_2_basic_wrapper_instance = await fa1_2_basic_wrapper.new(initial_storage.initial_storage_fa1_2_wrapper);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_instances[0].address);
        console.log('FA1.2-WL contract deployed at:', fa1_2_instances[1].address);
        console.log('FA1.2-wrapper contract deployed at:', fa1_2_basic_wrapper_instance.address);
        storages[0] = await fa1_2_instances[0].storage();
        storages[1] = await fa1_2_instances[1].storage();
        wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
    });

    describe('get_allowance ', () => {
        it('returns expected value', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                    'allowance resonse should be zero before call, ' + name
                );

                // Verify initial value
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    bob.pkh,
                    alice.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(8)),
                    "Alice can spend 8 from Bob's account, " + name
                );

                // Verify initial value of 0
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    bob.pkh,
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                    "Charlie can spend 0 from Bob's account, " + name
                );

                // Verify initial value of 0
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    alice.pkh,
                    bob.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                    "Bob can spend 0 from Alice's account, " + name
                );

                // Allow Charlie to spend from Alice's account and verify that
                // the value is updated correcly
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    alice.pkh,
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                    "Charlie can spend 0 from Alice's account prior to approval, " + name
                );

                await instance.approve(charlie.pkh, 5);
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    alice.pkh,
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(5)),
                    "Charlie can spend 5 from Alice's account after approval, " + name
                );

                // Set allowance back to 0 to prevent this from disturbing state
                await instance.approve(charlie.pkh, 0);
                await fa1_2_basic_wrapper_instance.call_get_allowance(
                    alice.pkh,
                    charlie.pkh,
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                assert(
                    wrapper_storage.allowance_response.isEqualTo(new BigNumber(0)),
                    "Charlie can spend 0 from Alice's account after reset of approval, " + name
                );
            }
        });
    });
});
