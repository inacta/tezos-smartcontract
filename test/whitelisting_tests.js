const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie } = require('./../scripts/sandbox/accounts');


contract('fa2_wl', _accounts => {
    let storage;
    let fa2_wl_instance;
    let fa2_wl_wrapper_instance;

    async function addWhitelisters(new_whitelister_addresses) {
        const whitelisterParam = new_whitelister_addresses.map(function (x) { return { 'add_whitelister': x } });
        await fa2_wl_instance.update_whitelisters(whitelisterParam);
    }

    async function addWhitelisteds(new_whitelisted_addresses) {
        const whitelistedParam = new_whitelisted_addresses.map(function (x) { return { 'add_whitelisted': x } });
        await fa2_wl_instance.update_whitelisteds(whitelistedParam);
    }

    async function removeWhitelisters(whitelister_addresses) {
        const whitelisterParam = whitelister_addresses.map(function (x) { return { 'remove_whitelister': x } });
        await fa2_wl_instance.update_whitelisters(whitelisterParam);
    }

    async function removeWhitelisteds(whitelisted_addresses) {
        const whitelistedParam = whitelisted_addresses.map(function (x) { return { 'remove_whitelisted': x } });
        await fa2_wl_instance.update_whitelisteds(whitelistedParam);
    }

    before(async () => {
        fa2_wl_instance = await fa2_wl.deployed();
        fa2_wl_wrapper_instance = await fa2_wl_wrapper.deployed();

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('Contract deployed at:', fa2_wl_instance.address);
        console.log('Wrapper contract deployed at:', fa2_wl_wrapper_instance.address);
        storage = await fa2_wl_instance.storage();
        wrapper_storage = await fa2_wl_wrapper_instance.storage();
    });

    describe('whitelisteds', () => {
        it('whitelisters should be able to add whitelisted', async () => {
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 0, 'initial whitelisters list must be empty');
            assert.equal(storage.whitelisteds.length, 0, 'initial whitelisteds list must be empty');

            var whitelistedParam = [
                {
                    'add_whitelisted': bob.pkh
                }
            ];

            // Verify that Alice cannot add Bob as whitelisted since Alice is not whitelister
            try {
                await fa2_wl_instance.update_whitelisteds(whitelistedParam);
            } catch (error) {
                assert.equal(error.message, constants.contractErrors.onlyWlrCanAddWld);
            }
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 0, 'whitelisters list must be empty since call to add failed');
            assert.equal(storage.whitelisteds.length, 0, 'whitelisteds list must be empty since call to add failed');

            // Add Alice as Whitelister and verify that she can now add Bob as whitelisted
            var whitelisterParam = [
                {
                    'add_whitelister': alice.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            await fa2_wl_instance.update_whitelisteds(whitelistedParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisteds.length, 1, 'whitelisted list must now have one element');
            assert.equal(storage.whitelisters.length, 1, 'whitelister list must now have one element');
            assert.equal(storage.whitelisteds[0], bob.pkh, 'Bob must be added as whitelisted');

            // Verify that whitelisteds can be removed again
            whitelistedParam = [
                {
                    'remove_whitelisted': bob.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisteds(whitelistedParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisteds.length, 0, 'whitelisted list must now be empty again');
            assert.equal(storage.whitelisters.length, 1, 'whitelister list must still have one element');

            // Remove whitelister again to restore state, as it keeps interfering with later tests
            whitelisterParam = [
                {
                    'remove_whitelister': alice.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisteds.length, 0, 'whitelisted list must still be empty');
            assert.equal(storage.whitelisters.length, 0, 'whitelister list must now be empty');
        })
    })

    describe('whitelisters', () => {
        it('whitelist admins should be able to add whitelister', async () => {
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 0, 'initial whitelisters list must be empty');

            // Add Bob as whitelister and verify that this works
            var whitelisterParam = [
                {
                    'add_whitelister': bob.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 1);
            assert.equal(storage.whitelisters[0], bob.pkh);

            // Add self and bob as whitelister in one call and verify that this works
            var whitelisterParam = [
                {
                    'add_whitelister': bob.pkh
                },
                {
                    'add_whitelister': alice.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 2);
            expect(storage.whitelisters.includes(bob.pkh)).to.be.true;
            expect(storage.whitelisters.includes(alice.pkh)).to.be.true;

            // Add Bob and Alice again and verify that nothing changes
            var whitelisterParam = [
                {
                    'add_whitelister': bob.pkh
                },
                {
                    'add_whitelister': alice.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 2);
            expect(storage.whitelisters.includes(bob.pkh)).to.be.true;
            expect(storage.whitelisters.includes(alice.pkh)).to.be.true;

            // Remove Alice and Bob and verify that this works
            var whitelisterParam = [
                {
                    'remove_whitelister': bob.pkh
                },
                {
                    'remove_whitelister': alice.pkh
                }
            ];
            await fa2_wl_instance.update_whitelisters(whitelisterParam);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelisters.length, 0);
        })
    })

    describe('Verify whitelisting behavior', () => {
        it('follows the correct whitelist rules for transfers', async () => {

            // Allow Alice (transaction originator) to update whitelisteds set
            // We need this for later
            await addWhitelisters([alice.pkh]);

            const aliceAccountStart = await storage.ledger.get(alice.pkh);
            const bobAccountStart = await storage.ledger.get(bob.pkh);
            var transferParamSingle = [
                {
                    token_id: 0,
                    amount: 1,
                    from_: alice.pkh,
                    to_: bob.pkh
                }
            ];
            var transferParamMultiple = [
                {
                    token_id: 0,
                    amount: 1,
                    from_: alice.pkh,
                    to_: bob.pkh
                },
                {
                    token_id: 0,
                    amount: 1,
                    from_: alice.pkh,
                    to_: charlie.pkh
                }
            ];

            // Neither sender nor receiver are whitelisted. Verify that is fails with message
            // FA2_SENDER_NOT_WHITELISTED
            try {
                await fa2_wl_instance.transfer(transferParamSingle);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.senderNotWhitelisted), 'fail when neither sender nor receiver are whitelisted';
            }

            try {
                await fa2_wl_instance.transfer(transferParamMultiple);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.senderNotWhitelisted);
            }

            expect((await storage.ledger.get(alice.pkh)).balance.isEqualTo(aliceAccountStart.balance)).to.be.true;
            expect((await storage.ledger.get(bob.pkh)).balance.isEqualTo(bobAccountStart.balance)).to.be.true;

            // Whitelist sender but not receiver, verify that call fails with message FA2_RECEIVER_NOT_WHITELISTED
            await addWhitelisteds([alice.pkh]);
            try {
                await fa2_wl_instance.transfer(transferParamSingle);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.receiverNotWhitelisted);
            }

            expect((await storage.ledger.get(alice.pkh)).balance.isEqualTo(aliceAccountStart.balance)).to.be.true;
            expect((await storage.ledger.get(bob.pkh)).balance.isEqualTo(bobAccountStart.balance)).to.be.true;

            // Whitelist receiver and remove whitelisting from sender. Verify that call fails with FA2_SENDER_NOT_WHITELISTED
            await removeWhitelisteds([alice.pkh]);
            await addWhitelisteds([bob.pkh]);
            try {
                await fa2_wl_instance.transfer(transferParamSingle);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.senderNotWhitelisted);
            }

            expect((await storage.ledger.get(alice.pkh)).balance.isEqualTo(aliceAccountStart.balance)).to.be.true;
            expect((await storage.ledger.get(bob.pkh)).balance.isEqualTo(bobAccountStart.balance)).to.be.true;

            // Whitelist sender *and* receiver. Verify that the call succeeds and that the balance changes
            await addWhitelisteds([alice.pkh]);
            await fa2_wl_instance.transfer(transferParamSingle);
            expect((await storage.ledger.get(alice.pkh)).balance.isEqualTo(aliceAccountStart.balance.minus(1))).to.be.true;
            expect((await storage.ledger.get(bob.pkh)).balance.isEqualTo(bobAccountStart.balance.plus(1))).to.be.true;

            // Verify that all transfers fail if one of the elements in the parameter to the function call fails
            // Here, Charlie is not whitelisted, but Alice and Bob are. Since one transfer call fails, all must fail
            try {
                await fa2_wl_instance.transfer(transferParamMultiple);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.receiverNotWhitelisted);
            }
            expect((await storage.ledger.get(alice.pkh)).balance.isEqualTo(aliceAccountStart.balance.minus(1))).to.be.true;
            expect((await storage.ledger.get(bob.pkh)).balance.isEqualTo(bobAccountStart.balance.plus(1))).to.be.true;

            // Remove both whitelisters and whitelisteds to restore state
            await removeWhitelisteds([alice.pkh, bob.pkh]);
            await removeWhitelisters([alice.pkh]);
        });
    })

    // We run this test last since it tends to mess up the state of the contract
    // leaving our caller Alice without WL admin rights.
    describe('non-revocable whitelist admin', () => {
        it('can update non-revocable whitelist admin', async () => {
            // Verify that Alice cannot renounce her WL admin role as she is non-revocable WL admin
            try {
                await fa2_wl_instance.renounce_wl_admin([["unit"]]);
            } catch (error) {
                assert.equal(error.message, constants.contractErrors.callerIsNonRevocableWlAdmin);
            }

            // Disallow setting Bob as New non-revocable whitelist admin since Bob is not whitelisting admin
            assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);
            try {
                await fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh);
            } catch (error) {
                assert.equal(error.message, constants.contractErrors.newNrWlAdminNotWlAdmin);
            }
            assert.equal(alice.pkh, storage.non_revocable_whitelist_admin);

            // Set Bob to be WL admin and verify that storage is updated correctly
            await fa2_wl_instance.add_wl_admin(bob.pkh);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.whitelist_admins.length, 2);
            assert.equal(storage.non_revocable_whitelist_admin, alice.pkh);
            expect(storage.whitelist_admins.includes(bob.pkh)).to.be.true;
            expect(storage.whitelist_admins.includes(alice.pkh)).to.be.true;

            // Verify that Bob can now take the non-revocable role and that alice is *not* removed as a whitelist admin
            // even though she gave up the non-revocable role
            await fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 2);
            expect(storage.whitelist_admins.includes(bob.pkh)).to.be.true;
            expect(storage.whitelist_admins.includes(alice.pkh)).to.be.true;

            // Ensure that the correct error message is presented when anyone else but the non-revocable WL admin attempts to
            // pass this role on
            try {
                await fa2_wl_instance.set_non_revocable_wl_admin(bob.pkh);
            } catch (error) {
                assert.equal(error.message, constants.contractErrors.notNrWlAdmin);
            }

            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 2);
            expect(storage.whitelist_admins.includes(bob.pkh)).to.be.true;
            expect(storage.whitelist_admins.includes(alice.pkh)).to.be.true;

            // Verify that Alice can now renounce her WL admin role
            await fa2_wl_instance.renounce_wl_admin([["unit"]]);
            storage = await fa2_wl_instance.storage();
            assert.equal(storage.non_revocable_whitelist_admin, bob.pkh);
            assert.equal(storage.whitelist_admins.length, 1);
            expect(storage.whitelist_admins.includes(bob.pkh)).to.be.true;
            expect(storage.whitelist_admins.includes(alice.pkh)).to.be.false;

            // Unfortunately, we have to redeploy the contract here to restore state
            // Otherwise Bob is WL admin and Alice is not and we need Alice as WL admin
            // for other tests
            fa2_wl_instance = await fa2_wl.deployed();
        })
    })
});
