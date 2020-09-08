const BigNumber = require('bignumber.js');
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
const fa2_with_whitelisting = artifacts.require('fa2_with_particular_whitelisting');
const initial_storage = require('../../helpers/storage');
const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');
const fa1_2Constants = require('../../helpers/fa1_2Constants.js');
const fa2Constants = require('../../helpers/fa2Constants.js');
const {
    addWhitelisters,
    expectThrow,
    removeWhitelisters,
} = require('../shared_utils.js');

contract('FA2 w/ whitelisting and FA1.2 w/ whitelisting', (_accounts) => {
    let storages = [];
    let fa_instances = [];
    let contract_names = [];

    before(async () => {
        fa_instances[0] = await fa1_2_with_whitelisting.new(initial_storage.initial_storage_fa1_2_with_whitelisting_no_whitelisted);
        fa_instances[1] = await fa2_with_whitelisting.new(initial_storage.initial_storage_fa2_pwl);
        contract_names[0] = "FA1.2 w/ whitelisting";
        contract_names[1] = "FA2 w/ whitelisting";

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa_instances[0].address);
        console.log('FA1.2-WL contract deployed at:', fa_instances[1].address);
        storages[0] = await fa_instances[0].storage();
        storages[1] = await fa_instances[1].storage();
    });

    describe('whitelisters', () => {
        it('whitelist admins should be able to add whitelister', async () => {
            for (let i = 0; i < fa_instances.length; i++) {
                const instance = fa_instances[i];
                const name = contract_names[i];
                var storage = storages[i];
                assert.equal(
                    storage.whitelisters.length,
                    0,
                    'initial whitelisters list must be empty'
                );

                // Add Bob as whitelister and verify that this works
                await instance.update_whitelisters(addWhitelisters([bob]));
                storage = await instance.storage();
                assert.equal(storage.whitelisters.length, 1);
                assert.equal(storage.whitelisters[0], bob.pkh);

                // Add self and bob as whitelister in one call and verify that this works
                await instance.update_whitelisters(
                    addWhitelisters([alice, bob])
                );
                storage = await instance.storage();
                assert.equal(storage.whitelisters.length, 2);
                assert(storage.whitelisters.includes(bob.pkh));
                assert(storage.whitelisters.includes(alice.pkh));

                // Add Bob and Alice again and verify that nothing changes
                await instance.update_whitelisters(
                    addWhitelisters([alice, bob])
                );
                storage = await instance.storage();
                assert.equal(storage.whitelisters.length, 2);
                assert(storage.whitelisters.includes(bob.pkh));
                assert(storage.whitelisters.includes(alice.pkh));

                // Remove Alice and Bob and verify that this works
                await instance.update_whitelisters(
                    removeWhitelisters([alice, bob])
                );
                storage = await instance.storage();
                assert.equal(storage.whitelisters.length, 0);
            }
        });
    });

    // We run this test last since it tends to mess up the state of the contract
    // leaving our caller Alice without WL admin rights.
    describe('non-revocable whitelist admin', () => {
        it('can update non-revocable whitelist admin', async () => {
            for (let i = 0; i < fa_instances.length; i++) {
                const instance = fa_instances[i];
                const name = contract_names[i];
                var storage = storages[i];

                // Verify that Alice cannot renounce her WL admin role as she is non-revocable WL admin
                await expectThrow(
                    instance.renounce_wl_admin([['unit']]),
                    fa2Constants.contractErrors.callerIsNonRevocableWlAdmin
                );

                // Disallow setting Bob as New non-revocable whitelist admin since Bob is not whitelisting admin
                assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);
                await expectThrow(
                    instance.set_non_revocable_wl_admin(bob.pkh),
                    fa2Constants.contractErrors.newNrWlAdminNotWlAdmin
                );
                assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);

                // Set Bob to be WL admin and verify that storage is updated correctly
                await instance.add_wl_admin(bob.pkh);
                storage = await instance.storage();
                assert.equal(storage.whitelist_admins.length, 2);
                assert.equal(storage.non_revocable_whitelist_admin, alice.pkh);
                assert(storage.whitelist_admins.includes(bob.pkh));
                assert(storage.whitelist_admins.includes(alice.pkh));

                // Verify that Bob can now take the non-revocable role and that alice is *not* removed as a whitelist admin
                // even though she gave up the non-revocable role
                await instance.set_non_revocable_wl_admin(bob.pkh);
                storage = await instance.storage();
                assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
                assert.equal(storage.whitelist_admins.length, 2);
                assert(storage.whitelist_admins.includes(bob.pkh));
                assert(storage.whitelist_admins.includes(alice.pkh));

                // Ensure that the correct error message is presented when anyone else but the non-revocable WL admin attempts to
                // pass this role on
                await expectThrow(
                    instance.set_non_revocable_wl_admin(bob.pkh),
                    fa2Constants.contractErrors.notNrWlAdmin
                );

                storage = await instance.storage();
                assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
                assert.equal(storage.whitelist_admins.length, 2);
                assert(storage.whitelist_admins.includes(bob.pkh));
                assert(storage.whitelist_admins.includes(alice.pkh));

                // Verify that Alice can now renounce her WL admin role
                await instance.renounce_wl_admin([['unit']]);
                storage = await instance.storage();
                assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
                assert.equal(storage.whitelist_admins.length, 1);
                assert(storage.whitelist_admins.includes(bob.pkh));
                assert(!storage.whitelist_admins.includes(alice.pkh));
            }
        });
    });
});
