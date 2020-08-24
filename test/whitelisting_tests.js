const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');
const {
    addWhitelisters,
    addWhitelisteds,
    removeWhitelisters,
    removeWhitelisteds,
    transferParams,
    expectThrow,
} = require('./util.js');

contract('fa2_wl', (_accounts) => {
    let storage;
    let fa2_wl_instance;
    let fa2_wl_wrapper_instance;
    let accounts;

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

    describe('whitelisters and whitelisteds', () => {
        it('should not throw when removing non-existent ones', async () => {
            storage = await fa2_wl_instance.storage();
            assert.equal(
                storage.whitelisters.length,
                0,
                'initial whitelisters list must be empty'
            );

            accounts = [alice, bob, charlie, david];
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted initially`);
            }
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );

            // This is necessary, so alice can update whitelisteds
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });
    });

    describe('whitelisteds', () => {
        it('whitelisters should be able to add whitelisted', async () => {
            storage = await fa2_wl_instance.storage();
            assert.equal(
                storage.whitelisters.length,
                0,
                'initial whitelisters list must be empty'
            );
            accounts = [alice, bob, charlie, david];
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted initially`);
            }
            // Verify that Alice cannot add Bob as whitelisted since Alice is not whitelister
            await expectThrow(
                fa2_wl_instance.update_whitelisteds(addWhitelisteds([bob])),
                constants.contractErrors.onlyWlrCanAddWld
            );
            storage = await fa2_wl_instance.storage();
            assert.equal(
                storage.whitelisters.length,
                0,
                'whitelisters list must be empty since call to add failed'
            );
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after failed call to whitelist`);
            }

            // Add Alice as Whitelister and verify that she can now add Bob as whitelisted
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([bob]));
            storage = await fa2_wl_instance.storage();
            accounts = [alice, charlie, david];
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after successful call to whitelist Bob`);
            }
            assert.notEqual((await storage.whitelisteds.get(bob.pkh)).length, 0, 'Bob is whitelisted after succesful call to whitelist');
            assert.equal(
                storage.whitelisters.length,
                1,
                'whitelister list must now have one element'
            );
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

            // Verify that whitelisteds can be removed again
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([bob])
            );
            storage = await fa2_wl_instance.storage();
            accounts = [alice, bob, charlie, david];
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after successful call to remove Bob from whitelisteds`);
            }

            // Remove whitelister again to restore state, as it keeps interfering with later tests
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
            storage = await fa2_wl_instance.storage();
            for (var i = 0; i < accounts.length; i++) {
                const val = await storage.whitelisteds.get(accounts[i].pkh);
                assert(val === undefined || val.length === 0, `${accounts[i].name} is not whitelisted after successful call to remove Alice as whitelister`);
            }
            assert.equal(
                storage.whitelisters.length,
                0,
                'whitelister list must now be empty'
            );
        });
    });

    describe('whitelisters', () => {
        it('whitelist admins should be able to add whitelister', async () => {
            storage = await fa2_wl_instance.storage();
            assert.equal(
                storage.whitelisters.length,
                0,
                'initial whitelisters list must be empty'
            );

            // Add Bob as whitelister and verify that this works
            await fa2_wl_instance.update_whitelisters(addWhitelisters([bob]));
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 1);
            assert.equal(storage.whitelisters[0], bob.pkh);

            // Add self and bob as whitelister in one call and verify that this works
            await fa2_wl_instance.update_whitelisters(
                addWhitelisters([alice, bob])
            );
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 2);
            assert(storage.whitelisters.includes(bob.pkh));
            assert(storage.whitelisters.includes(alice.pkh));

            // Add Bob and Alice again and verify that nothing changes
            await fa2_wl_instance.update_whitelisters(
                addWhitelisters([alice, bob])
            );
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 2);
            assert(storage.whitelisters.includes(bob.pkh));
            assert(storage.whitelisters.includes(alice.pkh));

            // Remove Alice and Bob and verify that this works
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice, bob])
            );
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 0);
        });
    });

    describe('Verify whitelisting behavior', () => {
        it('follows the correct whitelist rules for transfers', async () => {
            // Allow Alice (transaction originator) to update whitelisteds set
            // We need this for later
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));

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
                fa2_wl_instance.transfer(transferParamSingle),
                constants.contractErrors.senderNotWhitelisted
            );
            await expectThrow(
                fa2_wl_instance.transfer(transferParamMultiple),
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
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([alice]));
            await expectThrow(
                fa2_wl_instance.transfer(transferParamSingle),
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
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice])
            );
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([bob]));
            await expectThrow(
                fa2_wl_instance.transfer(transferParamSingle),
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
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([alice]));
            await fa2_wl_instance.transfer(transferParamSingle);
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
                fa2_wl_instance.transfer(transferParamMultiple),
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
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });
    });

    describe('whitelisting for multi-asset functionality', () => {
        it('Can be whitelisted for different assets', async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([alice], 0));
            storage = await fa2_wl_instance.storage();
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
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([alice], 1));
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
            await fa2_wl_instance.update_whitelisteds(addWhitelisteds([alice], 1));
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
            await fa2_wl_instance.update_whitelisteds(
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
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice], 1)
            );
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert(whitelistingVal === undefined || whitelistingVal.length === 0, `Alice is no longer whitelisted`);
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice], 1)
            );
            whitelistingVal = (await storage.whitelisteds.get(alice.pkh)).map( x => x.toNumber() );
            assert(whitelistingVal === undefined || whitelistingVal.length === 0, `Alice is still not whitelisted`);
        })
    });

    // We run this test last since it tends to mess up the state of the contract
    // leaving our caller Alice without WL admin rights.
    describe('non-revocable whitelist admin', () => {
        it('can update non-revocable whitelist admin', async () => {
            // Verify that Alice cannot renounce her WL admin role as she is non-revocable WL admin
            await expectThrow(
                fa2_wl_instance.renounce_wl_admin([['unit']]),
                constants.contractErrors.callerIsNonRevocableWlAdmin
            );

            // Disallow setting Bob as New non-revocable whitelist admin since Bob is not whitelisting admin
            assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);
            await expectThrow(
                fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh),
                constants.contractErrors.newNrWlAdminNotWlAdmin
            );
            assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);

            // Set Bob to be WL admin and verify that storage is updated correctly
            await fa2_wl_instance.add_wl_admin(bob.pkh);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelist_admins.length, 2);
            assert.equal(storage.non_revocable_whitelist_admin, alice.pkh);
            assert(storage.whitelist_admins.includes(bob.pkh));
            assert(storage.whitelist_admins.includes(alice.pkh));

            // Verify that Bob can now take the non-revocable role and that alice is *not* removed as a whitelist admin
            // even though she gave up the non-revocable role
            await fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 2);
            assert(storage.whitelist_admins.includes(bob.pkh));
            assert(storage.whitelist_admins.includes(alice.pkh));

            // Ensure that the correct error message is presented when anyone else but the non-revocable WL admin attempts to
            // pass this role on
            await expectThrow(
                fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh),
                constants.contractErrors.notNrWlAdmin
            );

            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 2);
            assert(storage.whitelist_admins.includes(bob.pkh));
            assert(storage.whitelist_admins.includes(alice.pkh));

            // Verify that Alice can now renounce her WL admin role
            await fa2_wl_instance.renounce_wl_admin([['unit']]);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 1);
            assert(storage.whitelist_admins.includes(bob.pkh));
            assert(!storage.whitelist_admins.includes(alice.pkh));

            // Unfortunately, we have to redeploy the contract here to restore state
            // Otherwise Bob is WL admin and Alice is not and we need Alice as WL admin
            // for other tests
            fa2_wl_instance = await fa2_wl.deployed();
        });
    });
});
