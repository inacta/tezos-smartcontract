const BigNumber = require('bignumber.js');
const fa2_wl = artifacts.require('fa2_with_whitelisting');
const { networks } = require('./../truffle-config');

const { deployWithAliceAsWlAdmin, initial_storage } = require('../migrations/1_deploy_tzip_12_tutorial.js');
const constants = require('./../helpers/constants.js');
/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');

contract('fa2_wl', accounts => {
    let storage;
    let fa2_wl_instance;

    before(async () => {
        fa2_wl_instance = await fa2_wl.deployed();
        /**
         * Display the current contract address for debugging purposes
         */
        // console.log('Contract deployed at:', tzip_12_tutorial_instance.address);
        storage = await fa2_wl_instance.storage();
    });

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
        })
    })

    describe('get token information', () => {
        it('should be able to read token information from storage as specified in FA2/TZIP-12', async () => {
            // I think the type of the key of all big_maps has to be string
            const asset_info = await storage.token_metadata.get(`0`);
            assert.equal(0, asset_info.token_id);
            assert.equal("CVL0", asset_info.symbol);
            assert.equal("Crypto Valley Labs, iteration 0", asset_info.name);
            assert.equal(6, asset_info.decimals);
        })
    })

    describe('update operators', () => {
        describe('add operator', () => {
            it('should not be allowed to add an operator for an address where the transaction is not originating', async () => {
                const tokenOwner = alice.pkh;
                const tokenOperator = bob.pkh;
                try {
                    await fa2_wl_instance.update_operators([{
                        'add_operator': {
                            owner: tokenOwner,
                            operator: tokenOperator
                        }
                    }]);
                } catch (error) {
                    assert.equal(error.message, constants.contractErrors.fromEqualToSenderAddress);
                }
            });

            it('should be able to add an operator', async () => {
                const tokenOwner = alice.pkh;
                const tokenOperator = bob.pkh;
                const accountBefore = await storage.ledger.get(tokenOwner);
                assert.equal(true, Array.isArray(accountBefore.allowances)); // I couldn't find an `assert.true`

                await fa2_wl_instance.update_operators([{
                    'add_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }]);
                const accountAfter = await storage.ledger.get(tokenOwner);
                assert.equal(1, accountAfter.allowances.length);
                assert.equal(true, Array.isArray(accountAfter.allowances)); // I couldn't find an `assert.true`

                // TODO: Verify that bob can now spend from Alice's account
            });

            it('adding an operator should be an idempotent operation', async () => {
                const tokenOwner = alice.pkh;

                const tokenOperator = bob.pkh;
                const updateParam = [{
                    'add_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }];

                // Call update_operators twice and ensure that only one entry has been made
                const prom = fa2_wl_instance.update_operators(updateParam);
                await fa2_wl_instance.update_operators(updateParam);
                prom.then(() => {
                    storage.ledger.get(tokenOwner).then(accountAfter => {
                        assert.equal(1, accountAfter.allowances.length);
                        assert.equal(tokenOperator, accountAfter.allowances[0]);
                    });
                });

                // Call it again and ensure that nothing has changed
                await fa2_wl_instance.update_operators(updateParam);
                storage.ledger.get(tokenOwner).then(accountAfter => {
                    assert.equal(1, accountAfter.allowances.length);
                    assert.equal(tokenOperator, accountAfter.allowances[0]);
                });
            });

            it('should be able to add and remove multiple allowances in one call', async () => {
                const tokenOwner = alice.pkh;
                const tokenOperator0 = bob.pkh;
                const tokenOperator1 = 'tz1PueLmqFpGmSNboPXvxDs6Th49xKwJfNAQ'; // random address found on Carthage net
                const addParam = [
                    {
                        'add_operator': {
                            owner: tokenOwner,
                            operator: tokenOperator0
                        }
                    },
                    {
                        'add_operator': {
                            owner: tokenOwner,
                            operator: tokenOperator1
                        }
                    }
                ];
                await fa2_wl_instance.update_operators(addParam);

                storage.ledger.get(tokenOwner).then(accountAfter => {
                    assert.equal(2, accountAfter.allowances.length);
                    assert.equal(true, accountAfter.allowances.includes(tokenOperator0));
                    assert.equal(true, accountAfter.allowances.includes(tokenOperator1));
                });

                const removeParam = [
                    {
                        'remove_operator': {
                            owner: tokenOwner,
                            operator: tokenOperator0
                        }
                    },
                    {
                        'remove_operator': {
                            owner: tokenOwner,
                            operator: tokenOperator1
                        }
                    }
                ];
                await fa2_wl_instance.update_operators(removeParam);
                storage.ledger.get(tokenOwner).then(accountAfter => {
                    assert.equal(0, accountAfter.allowances.length);
                });

                // Removing the operators again should be the unit identity operator as remove should be idempotent
                await fa2_wl_instance.update_operators(removeParam);
                storage.ledger.get(tokenOwner).then(accountAfter => {
                    assert.equal(0, accountAfter.allowances.length);
                });
            });
        });

        describe('remove operator', () => {
            it('should be able to add and remove an operator', async () => {
                const tokenOwner = alice.pkh;

                const tokenOperator = bob.pkh;
                await fa2_wl_instance.update_operators([{
                    'add_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }]);
                const accountMid = await storage.ledger.get(tokenOwner);
                assert.equal(1, accountMid.allowances.length);
                assert.equal(true, Array.isArray(accountMid.allowances));
                assert.equal(tokenOperator, accountMid.allowances[0]);

                const removeParam = [{
                    'remove_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }];
                await fa2_wl_instance.update_operators(removeParam);
                const accountAfter = await storage.ledger.get(tokenOwner);
                assert.equal(0, accountAfter.allowances.length);

                // Removing an operator should be an idempotent operation
                await fa2_wl_instance.update_operators(removeParam);
                const accountAfterAfter = await storage.ledger.get(tokenOwner);
                assert.equal(0, accountAfterAfter.allowances.length);
            });
        });
    });

    describe('transfer and balances', () => {
        const expectedBalanceAlice = initial_storage.ledger.get(alice.pkh).balance;
        const expectedBalanceBob = initial_storage.ledger.get(bob.pkh).balance;
        it(`should store a balance of ${expectedBalanceAlice} for Alice and ${expectedBalanceBob} for Bob`, async () => {
            /**
             * Get balance for Alice from the smart contract's storage (by a big map key)
             */
            const deployedAccountAliceProm = storage.ledger.get(alice.pkh);
            const deployedAccountBob = await storage.ledger.get(bob.pkh);
            deployedAccountAliceProm.then((alice) => {
                assert.equal(alice.balance, expectedBalanceAlice);
                assert.equal(deployedAccountBob.balance, expectedBalanceBob);
            });
        });

        it(`should not store any balance for Charlie`, async () => {
            let accountCharlie = await storage.ledger.get(charlie.pkh);
            assert.equal(accountCharlie, undefined);
        });

        const transferAmount = 1;
        it(`should transfer 1 token from Alice to Bob`, async () => {
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            const accountAliceBefore = await storage.ledger.get(alice.pkh);

            const transferParam = [
                {
                    /**
                     * token_id: 0 represents the single token_id within our contract
                     */
                    token_id: 0,
                    amount: transferAmount,
                    from_: alice.pkh,
                    to_: bob.pkh
                }
            ];

            await fa2_wl_instance.transfer(transferParam);
            const accountBobAfter = await storage.ledger.get(bob.pkh);
            const accountAliceAfter = await storage.ledger.get(alice.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance.minus(transferAmount))).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance.plus(transferAmount))).to.be.true;
        });

        it(`should not allow transfers from an address that did not sign the transaction and that has not been made operator`, async () => {
            const tsfAmount = 5;
            const transferParam = [
                {
                    token_id: 0,
                    amount: tsfAmount,
                    from_: bob.pkh,
                    to_: alice.pkh
                }
            ];

            let accountBobBefore;
            let accountAliceBefore;
            let accountBobAfter;
            let accountAliceAfter;
            var ranToCompletion = false;
            try {
                /**
                 * Transactions in the test suite are signed by a secret/private key
                 * configured in truffle-config.js
                 */
                accountBobBefore = await storage.ledger.get(bob.pkh);
                accountAliceBefore = await storage.ledger.get(alice.pkh);

                // Ensure that Bob has the necessary balance making the transfer to ensure that we are testing
                // the right thing
                expect(accountBobBefore.balance.isGreaterThanOrEqualTo(new BigNumber(tsfAmount))).to.be.true;

                await fa2_wl_instance.transfer(transferParam);

            } catch (e) {
                assert.equal(e.message, constants.contractErrors.fromEqualToSenderAddress);
                accountBobAfter = await storage.ledger.get(bob.pkh);
                accountAliceAfter = await storage.ledger.get(alice.pkh);
                expect(accountBobBefore.balance.isEqualTo(accountBobAfter.balance)).to.be.true;
                expect(accountAliceBefore.balance.isEqualTo(accountAliceAfter.balance)).to.be.true;
                ranToCompletion = true;
            }
            assert.equal(ranToCompletion, true);
        });

        it( "should allow an address in the allowances list to withdraw from an account", async () => {
            // Verify that 1 can be withdrawn as this is David's balance
            var accountDavid = await storage.ledger.get(david.pkh);
            expect(accountDavid.balance.isEqualTo(new BigNumber(2))).to.be.true;
            const transferParam = [
                {
                    token_id: 0,
                    // Alice's balance at this point is 9
                    amount: 1,
                    from_: david.pkh,
                    to_: alice.pkh
                }
            ];
            await fa2_wl_instance.transfer(transferParam);
            accountDavid = await storage.ledger.get(david.pkh);
            expect(accountDavid.balance.isEqualTo(new BigNumber(1))).to.be.true;

            // Transfer 1 from David to Bob
            accountDavid = await storage.ledger.get(david.pkh);
            transferParam[0].to_ = bob.pkh;
            await fa2_wl_instance.transfer(transferParam);
            accountDavid = await storage.ledger.get(david.pkh);
            expect(accountDavid.balance.isEqualTo(new BigNumber(0))).to.be.true;

            // Disallow another transaction since David's balance is now 0
            var ranToCompletion = false;
            try {
                await fa2_wl_instance.transfer(transferParam);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.insufficientBalance);
                ranToCompletion = true;
            }
            assert.equal(ranToCompletion, true);
        } )

        it(`should not transfer tokens from Alice to Bob when Alice's balance is insufficient`, async () => {
            const transferParam = [
                {
                    token_id: 0,
                    // Alice's balance at this point is 9
                    amount: 100,
                    from_: alice.pkh,
                    to_: bob.pkh
                }
            ];

            var ranToCompletion = false;
            try {
                await fa2_wl_instance.transfer(transferParam);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.insufficientBalance);
                ranToCompletion = true;
            }
            assert.equal(ranToCompletion, true);
        });
    });
});
