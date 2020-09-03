const fa2_pwl = artifacts.require('fa2_with_particular_whitelisting');
const fa2_uwl = artifacts.require('fa2_with_universal_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');
const initial_storage = require('./../../helpers/storage');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { bob } = require('../../scripts/sandbox/accounts');

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

    describe('Token_metadata_registry', () => {
        it('Token_metadata_registry endpoint responds with expected address', async () => {
            assert.equal(
                wrapper_storage.tmr_response,
                bob.pkh,
                "wrapper storage is initiated to Bob's PKH"
            );

            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];

                // Make method call and verify that this updates the storage of the wrapper contract
                await fa2_wl_wrapper_instance.call_token_metadata_registry(
                    instance.address
                );
                wrapper_storage = await fa2_wl_wrapper_instance.storage();
                assert.equal(
                    wrapper_storage.tmr_response,
                    instance.address,
                    'wrapper storage is changed to the FA2 contract address as this is where the contract metadata is found, ' + name
                );
            }
        });
    });

    describe('get token information', () => {
        it('should be able to read token information from storage as specified in FA2/TZIP-12', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];

                // I think the type of the key of all big_maps has to be string
                const asset_info = await storage.token_metadata.get('0');
                assert.equal(0, asset_info.token_id, name);
                assert.equal('CVL0', asset_info.symbol, name);
                assert.equal('Crypto Valley Labs, iteration 0', asset_info.name, name);
                assert.equal(6, asset_info.decimals, name);
            }
        });
    });
});
