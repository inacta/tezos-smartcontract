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

    describe('get_total_supply', () => {
        it('returns expected value', async () => {
            assert(
                wrapper_storage.total_supply_response.isEqualTo(new BigNumber(0)),
                'total supply resonse should be zero before call'
            );

            await fa1_2_basic_wrapper_instance.call_get_total_supply(
                fa1_2_basic_instance.address,
            );
            wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
            assert(
                wrapper_storage.total_supply_response.isEqualTo(new BigNumber(22)),
                "Initial total balance is 22"
            );
        });
    });
});
