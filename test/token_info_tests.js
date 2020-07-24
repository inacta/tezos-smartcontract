const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { bob } = require('./../scripts/sandbox/accounts');

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

    describe('Token_metadata_registry', () => {
        it('Token_metadata_registry endpoint responds with expected address', async () => {
            assert.equal(
                wrapper_storage.tmr_response,
                bob.pkh,
                "wrapper storage is initiated to Bob's PKH"
            );

            // Make method call and verify that this updates the storage of the wrapper contract
            await fa2_wl_wrapper_instance.call_token_metadata_registry(
                fa2_wl_instance.address
            );
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(
                wrapper_storage.tmr_response,
                fa2_wl_instance.address,
                'wrapper storage is changed to the FA2 contract address as this is where the contract metadata is found'
            );
        });
    });

    describe('get token information', () => {
        it('should be able to read token information from storage as specified in FA2/TZIP-12', async () => {
            // I think the type of the key of all big_maps has to be string
            const asset_info = await storage.token_metadata.get('0');
            assert.equal(0, asset_info.token_id);
            assert.equal('CVL0', asset_info.symbol);
            assert.equal('Crypto Valley Labs, iteration 0', asset_info.name);
            assert.equal(6, asset_info.decimals);
        });
    });
});
