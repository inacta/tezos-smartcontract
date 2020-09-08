const fa2_pwl = artifacts.require('fa2_with_particular_whitelisting');
const fa2_uwl = artifacts.require('fa2_with_universal_whitelisting');
const initial_storage = require('./../../helpers/storage');

const constants = require('../../helpers/fa2Constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../../scripts/sandbox/accounts');
const {
    addWhitelisteds,
    removeWhitelisteds,
    transferParams,
} = require('./util.js');

const {
    addWhitelistedsSingular,
    addWhitelisters,
    expectThrow,
    removeWhitelistedsSingular,
    removeWhitelisters } = require("../shared_utils.js");

    contract('fa2_pwl + fa2_uwl', (_accounts) => {
        let storages = [];
        let fa2_instances = [];
        let contract_names = [];
        let uses_particular_whitelistings = [];
        let accounts = [];

         // These are just added for readability
        let fa2_pwl_instance;
        let fa2_pwl_storage;

        before(async () => {
            fa2_instances[0] = await fa2_pwl.new(initial_storage.initial_storage_fa2_pwl);
            fa2_pwl_instance = fa2_instances[0];
            fa2_instances[1] = await fa2_uwl.new(initial_storage.initial_storage_fa2_uwl);
            contract_names[0] = "FA2 with particular whitelisting";
            contract_names[1] = "FA2 with universal whitelisting";
            uses_particular_whitelistings[0] = true;
            uses_particular_whitelistings[1] = false;

            /**
             * Display the current contract address for debugging purposes
             */
            console.log('FA2 PWL deployed at:', fa2_instances[0].address);
            console.log('FA2 UWL deployed at:', fa2_instances[1].address);
            storages[0] = await fa2_instances[0].storage();
            fa2_pwl_storage = storages[0];
            storages[1] = await fa2_instances[1].storage();
        });

    describe('whitelisters and whitelisteds', () => {
        it('should not throw when removing non-existent ones', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];
                uses_particular_whitelisting = uses_particular_whitelistings[i];

                assert.equal(
                    storage.whitelisters.length,
                    0,
                    'initial whitelisters list must be empty'
                );

                // Verify that the whitelisteds set is empty
                if (uses_particular_whitelisting) {
                    accounts = [alice, bob, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[j].name} is not whitelisted initially`);
                    }
                } else {
                    assert(storage.whitelisteds.length === 0, "No one is whitelisted initially");
                }

                // Verify that it does not throw when removing non-whitelister from whitelisters
                await instance.update_whitelisters(
                    removeWhitelisters([alice])
                );

                // This is necessary, so alice can update whitelisteds
                await instance.update_whitelisters(addWhitelisters([alice]));
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        removeWhitelisteds([alice])
                    );
                } else {
                    await instance.update_whitelisteds(
                        removeWhitelistedsSingular([alice])
                    );
                }
                await instance.update_whitelisters(
                    removeWhitelisters([alice])
                );
            }
        });
    });

    describe('whitelisteds', () => {
        it('whitelisters should be able to add whitelisted', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                var storage = storages[i];
                uses_particular_whitelisting = uses_particular_whitelistings[i];

                storage = await instance.storage();
                assert.equal(
                    storage.whitelisters.length,
                    0,
                    'initial whitelisters list must be empty'
                );

                // Verify that the whitelisteds set is empty
                if (uses_particular_whitelisting) {
                    accounts = [alice, bob, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[j].name} is not whitelisted initially`);
                    }
                } else {
                    assert(storage.whitelisteds.length === 0, "No one is whitelisted initially");
                }

                // Verify that Alice cannot add Bob as whitelisted since Alice is not whitelister
                if (uses_particular_whitelisting) {
                    await expectThrow(
                        instance.update_whitelisteds(addWhitelisteds([bob])),
                        constants.contractErrors.onlyWlrCanAddWld
                    );
                } else {
                    await expectThrow(
                        instance.update_whitelisteds(addWhitelistedsSingular([bob])),
                        constants.contractErrors.onlyWlrCanAddWld
                    );
                }
                storage = await instance.storage();
                assert.equal(
                    storage.whitelisters.length,
                    0,
                    'whitelisters list must be empty since call to add failed'
                );

                // Verify that the whitelisteds set is still empty
                if (uses_particular_whitelisting) {
                    accounts = [alice, bob, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after failed call to whitelist`);
                    }
                } else {
                    assert(storage.whitelisteds.length === 0, "No one is whitelisted after failed call to whitelist");
                }

                // Add Alice as Whitelister and verify that she can now add Bob as whitelisted
                await instance.update_whitelisters(addWhitelisters([alice]));
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        addWhitelisteds([bob])
                    );
                } else {
                    await instance.update_whitelisteds(
                        addWhitelistedsSingular([bob])
                    );
                }

                storage = await instance.storage();
                if (uses_particular_whitelisting) {
                    accounts = [alice, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[j].name} is not whitelisted after call to WL Bob`);
                        assert.notEqual((await storage.whitelisteds.get(bob.pkh)).length, 0, 'Bob is whitelisted after succesful call to whitelist');
                        assert.equal(
                            (await storage.whitelisteds.get(bob.pkh)).length,
                            1,
                            'Bob must be added as whitelisted for one asset'
                        );
                        assert.equal(
                            (await storage.whitelisteds.get(bob.pkh))[0],
                            0,
                            'Bob must be added as whitelisted for asset with token_id = 0'
                        );
                    }
                } else {
                    assert(storage.whitelisteds.length === 1, "Only 1 is whitelisted");
                    assert(storage.whitelisteds[0] === bob.pkh, "Bob is whitelisted");
                }
                assert.equal(
                    storage.whitelisters.length,
                    1,
                    'whitelister list must now have one element'
                );

                // Verify that whitelisteds can be removed again
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        removeWhitelisteds([bob])
                    );
                } else {
                    await instance.update_whitelisteds(
                        removeWhitelistedsSingular([bob])
                    );
                }

                // Verify that the whitelisteds set is still empty
                storage = await instance.storage();
                if (uses_particular_whitelisting) {
                    accounts = [alice, bob, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after successful call to de-whitelist Bob`);
                    }
                } else {
                    assert(storage.whitelisteds.length === 0, "No one is whitelisted after successful call to de-whitelist Bob");
                }

                // Remove whitelister again to restore state, as it keeps interfering with later tests
                await instance.update_whitelisters(
                    removeWhitelisters([alice])
                );
                storage = await instance.storage();

                // Verify that the whitelisteds set is still empty, after removing Alice from whitelisters
                storage = await instance.storage();
                if (uses_particular_whitelisting) {
                    accounts = [alice, bob, charlie, david];
                    for (var j = 0; j < accounts.length; j++) {
                        const val = await storage.whitelisteds.get(accounts[j].pkh);
                        assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted`);
                    }
                } else {
                    assert(storage.whitelisteds.length === 0, "No one is whitelisted");
                }
                assert.equal(
                    storage.whitelisters.length,
                    0,
                    'whitelister list must now be empty'
                );
            }
        });
    });

    describe('Verify whitelisting behavior', () => {
        it('follows the correct whitelist rules for transfers', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa2_instances[i];
                const name = contract_names[i];
                var storage = storages[i];
                uses_particular_whitelisting = uses_particular_whitelistings[i];

                // Allow Alice (transaction originator) to update whitelisteds set
                // We need this for later
                await instance.update_whitelisters(addWhitelisters([alice]));

                const aliceAccountStart = await storage.ledger.get(alice.pkh);
                const bobAccountStart = await storage.ledger.get(bob.pkh);
                var transferParamSingle = transferParams([
                    { from: alice, to: [[bob, 1]] },
                ]);
                var transferParamMultiple = transferParams([
                    {
                        from: alice,
                        to: [
                            [bob, 1],
                            [charlie, 1],
                        ],
                    },
                ]);

                // Neither sender nor receiver are whitelisted. Verify that is fails with message
                // FA2_SENDER_NOT_WHITELISTED
                await expectThrow(
                    instance.transfer(transferParamSingle),
                    constants.contractErrors.senderNotWhitelisted
                );
                await expectThrow(
                    instance.transfer(transferParamMultiple),
                    constants.contractErrors.senderNotWhitelisted
                );

                assert(
                    (await storage.ledger.get(alice.pkh)).balances.get('0').isEqualTo(
                        aliceAccountStart.balances.get('0')
                    )
                );
                assert(
                    (await storage.ledger.get(bob.pkh)).balances.get('0').isEqualTo(
                        bobAccountStart.balances.get('0')
                    )
                );

                // Whitelist sender but not receiver, verify that call fails with message FA2_RECEIVER_NOT_WHITELISTED
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        addWhitelisteds([alice])
                    );
                } else {
                    await instance.update_whitelisteds(
                        addWhitelistedsSingular([alice])
                    );
                }

                await expectThrow(
                    instance.transfer(transferParamSingle),
                    constants.contractErrors.receiverNotWhitelisted
                );

                assert(
                    (await storage.ledger.get(alice.pkh)).balances.get('0').isEqualTo(
                        aliceAccountStart.balances.get('0')
                    )
                );
                assert(
                    (await storage.ledger.get(bob.pkh)).balances.get('0').isEqualTo(
                        bobAccountStart.balances.get('0')
                    )
                );

                // Whitelist receiver and remove whitelisting from sender. Verify that call fails with FA2_SENDER_NOT_WHITELISTED
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        removeWhitelisteds([alice])
                    );
                } else {
                    await instance.update_whitelisteds(
                        removeWhitelistedsSingular([alice])
                    );
                }

                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        addWhitelisteds([bob])
                    );
                } else {
                    await instance.update_whitelisteds(
                        addWhitelistedsSingular([bob])
                    );
                }
                await expectThrow(
                    instance.transfer(transferParamSingle),
                    constants.contractErrors.senderNotWhitelisted
                );

                assert(
                    (await storage.ledger.get(alice.pkh)).balances.get('0').isEqualTo(
                        aliceAccountStart.balances.get('0')
                    )
                );
                assert(
                    (await storage.ledger.get(bob.pkh)).balances.get('0').isEqualTo(
                        bobAccountStart.balances.get('0')
                    )
                );

                // Whitelist sender *and* receiver. Verify that the call succeeds and that the balance changes
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        addWhitelisteds([alice])
                    );
                } else {
                    await instance.update_whitelisteds(
                        addWhitelistedsSingular([alice])
                    );
                }
                await instance.transfer(transferParamSingle);
                assert(
                    (await storage.ledger.get(alice.pkh)).balances.get('0').isEqualTo(
                        aliceAccountStart.balances.get('0').minus(1)
                    )
                );
                assert(
                    (await storage.ledger.get(bob.pkh)).balances.get('0').isEqualTo(
                        bobAccountStart.balances.get('0').plus(1)
                    )
                );

                // Verify that all transfers fail if one of the elements in the parameter to the function call fails
                // Here, Charlie is not whitelisted, but Alice and Bob are. Since one transfer call fails, all must fail
                await expectThrow(
                    instance.transfer(transferParamMultiple),
                    constants.contractErrors.receiverNotWhitelisted
                );
                assert(
                    (await storage.ledger.get(alice.pkh)).balances.get('0').isEqualTo(
                        aliceAccountStart.balances.get('0').minus(1)
                    )
                );
                assert(
                    (await storage.ledger.get(bob.pkh)).balances.get('0').isEqualTo(
                        bobAccountStart.balances.get('0').plus(1)
                    )
                );

                // Remove both whitelisters and whitelisteds to restore state
                if (uses_particular_whitelisting) {
                    await instance.update_whitelisteds(
                        removeWhitelisteds([alice, bob])
                    );
                } else {
                    await instance.update_whitelisteds(
                        removeWhitelistedsSingular([alice, bob])
                    );
                }
                await instance.update_whitelisters(
                    removeWhitelisters([alice])
                );
            }
        });
    });

    // This test is only run for the FA2 contract with particular whitelisting
    // functionality, as opposed to universal whitelisting functionality
    describe('whitelisting for multi-asset functionality', () => {
        it('Can be whitelisted for different assets', async () => {
            await fa2_pwl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_pwl_instance.update_whitelisteds(addWhitelisteds([alice], 0));
            storage = await fa2_pwl_instance.storage();
            var whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert.equal(
                whitelistingVal.length,
                1,
                'Alice must be added as whitelisted for asset with token_id = 0'
            );
            assert.equal(
                whitelistingVal[0],
                0,
                'Alice must be added as whitelisted for asset with token_id = 0'
            );

            // Add whitelisting for token_id = 1 and verify storage update
            await fa2_pwl_instance.update_whitelisteds(addWhitelisteds([alice], 1));
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert.equal(
                whitelistingVal.length,
                2,
                'Alice must be added as whitelisted for two assets'
            );
            assert(
                whitelistingVal.includes(0) && whitelistingVal.includes(1),
                'Alice must be added as whitelisted for asset with token_id = 0 and token_id = 1'
            );

            // Add Alice as whitelisted again and verify that this is idempotent operation
            // when applied for same asset
            // Add whitelisting for token_id = 1 and verify storage update
            await fa2_pwl_instance.update_whitelisteds(addWhitelisteds([alice], 1));
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert.equal(
                whitelistingVal.length,
                2,
                'Alice must be added as whitelisted two assets'
            );
            assert(
                whitelistingVal.includes(0) && whitelistingVal.includes(1),
                'Alice must still be added as whitelisted for asset with token_id = 0 and token_id = 1'
            );

            // Remove Alice from whitelisteds for token_id = 0
            await fa2_pwl_instance.update_whitelisteds(
                removeWhitelisteds([alice], 0)
            );
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert.equal(
                whitelistingVal.length,
                1,
                'Alice must be added as whitelisted for one asset'
            );
            assert.equal(
                whitelistingVal[0],
                1,
                'Alice must be added as whitelisted for asset with token_id = 1'
            );

            // Remove Alice from whitelisteds for token_id = 1,
            // and verify that this is also a idempotent operation
            await fa2_pwl_instance.update_whitelisteds(
                removeWhitelisteds([alice], 1)
            );
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert(whitelistingVal === undefined || whitelistingVal.length === 0, `Alice is no longer whitelisted`);
            await fa2_pwl_instance.update_whitelisteds(
                removeWhitelisteds([alice], 1)
            );
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert(whitelistingVal === undefined || whitelistingVal.length === 0, `Alice is still not whitelisted`);
        })
    });
});
