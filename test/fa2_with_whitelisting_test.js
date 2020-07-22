const BigNumber = require('bignumber.js');
const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const { initial_storage } = require('../migrations/1_deploy_fa2_with_whitelisting.js');
const { wrapper_initial_storage } = require('../migrations/1_deploy_fa2_wl_wrapper.js');
const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');


contract('fa2_wl', accounts => {
    let storage;
    let wrapper_storage;
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

    describe('token contract wrapper', () => {
        it('Token_metadata_registry endpoint responds with expected address', async () => {
            assert.equal(wrapper_storage.tmr_response, bob.pkh, "wrapper storage is initiated to Bob's PKH");

            // Make method call and verify that this updates the storage of the wrapper contract
            await fa2_wl_wrapper_instance.call_token_metadata_registry(fa2_wl_instance.address);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.tmr_response, fa2_wl_instance.address, "wrapper storage is changed to the FA2 contract address as this is where the contract metadata is found");
        });
    });

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

        it(`should transfer 1 token from Alice to Bob`, async () => {
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            const accountAliceBefore = await storage.ledger.get(alice.pkh);

            // Add Alice and Bob to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await addWhitelisters([alice.pkh]);
            await addWhitelisteds([alice.pkh, bob.pkh]);

            // Verify that transactions with 0 amount are possible, and that they
            // do not affect balances (part of FA2 spec that this must pass)
            const transferParam = [
                {
                    token_id: 0,
                    amount: 0,
                    from_: alice.pkh,
                    to_: bob.pkh
                }
            ];
            await fa2_wl_instance.transfer(transferParam);
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance)).to.be.true;

            // Verify that Alice can send to herself. It is a part of the FA2 spec
            // that this must pass. Verify this for both 0 amount and 1 amount
            transferParam[0].to_ = alice.pkh;
            await fa2_wl_instance.transfer(transferParam);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance)).to.be.true;

            const transferAmount = 1;
            transferParam[0].amount = transferAmount;
            await fa2_wl_instance.transfer(transferParam);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance)).to.be.true;

            // Verify that 1 token can be transferred from Alice to Bob
            transferParam[0].to_ = bob.pkh;
            await fa2_wl_instance.transfer(transferParam);
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance.minus(transferAmount))).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance.plus(transferAmount))).to.be.true;

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await removeWhitelisteds([alice.pkh, bob.pkh]);
            await removeWhitelisters([alice.pkh]);
        });

        it(`should not allow transfers from an address that did not sign the transaction and that has not been made operator`, async () => {

            // Add Alice and Bob to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await addWhitelisters([alice.pkh]);
            await addWhitelisteds([alice.pkh, bob.pkh]);

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

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await removeWhitelisteds([alice.pkh, bob.pkh]);
            await removeWhitelisters([alice.pkh]);
        });

        it("should allow an address in the allowances list to withdraw from an account", async () => {

            // Add Alice, Bob and David to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await addWhitelisters([alice.pkh]);
            await addWhitelisteds([alice.pkh, bob.pkh, david.pkh]);

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

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await removeWhitelisteds([alice.pkh, bob.pkh, david.pkh]);
            await removeWhitelisters([alice.pkh]);
        })

        it(`should not transfer tokens from Alice to Bob when Alice's balance is insufficient`, async () => {
            await addWhitelisters([alice.pkh]);
            await addWhitelisteds([alice.pkh, bob.pkh]);

            const transferParam = [
                {
                    token_id: 0,
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

            // Change amount and verify that it works
            transferParam[0].amount = 1;
            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            await fa2_wl_instance.transfer(transferParam);
            const accountAliceAfter = await storage.ledger.get(alice.pkh);
            const accountBobAfter = await storage.ledger.get(bob.pkh);
            expect(accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance.minus(1))).to.be.true;
            expect(accountBobAfter.balance.isEqualTo(accountBobBefore.balance.plus(1))).to.be.true;

            await removeWhitelisteds([alice.pkh, bob.pkh]);
            await removeWhitelisters([alice.pkh]);
        });
    });

    describe('Verify whitelisting behavior', () => {
        it('follows correct rules for whitelisting', async () => {

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
            // storage.ledger.get(alice.pkh).then(acc => expect(acc.balance.isEqualTo(aliceAccountStart.balance)).to.be.true);
            // storage.ledger.get(bob.pkh).then(acc => expect(acc.balance.isEqualTo(bobAccountStart.balance)).to.be.true);

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
