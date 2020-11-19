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

    describe('get_total_supply', () => {
        it('returns expected value', async () => {
            assert(
                wrapper_storage.total_supply_response.isEqualTo(new BigNumber(0)),
                'total supply resonse should be zero before call, '
            );

            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];

                await fa1_2_basic_wrapper_instance.call_get_total_supply(
                    instance.address,
                );
                wrapper_storage = await fa1_2_basic_wrapper_instance.storage();
                const initial_supply = name === 'fa1_2_kiss' ? 132 : 22;
                assert(
                    wrapper_storage.total_supply_response.isEqualTo(new BigNumber(initial_supply)),
                    `Initial total balance is ${initial_supply}, ` + name
                );
            }
        });
    });
});
