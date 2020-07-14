const tzip_12_tutorial = artifacts.require('tzip_12_tutorial');

const { initial_storage } = require('../migrations/1_deploy_tzip_12_tutorial.js');
const constants = require('./../helpers/constants.js');
/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob } = require('./../scripts/sandbox/accounts');

contract('tzip_12_tutorial', accounts => {
    let storage;
    let tzip_12_tutorial_instance;

    before(async () => {
        tzip_12_tutorial_instance = await tzip_12_tutorial.deployed();
        /**
         * Display the current contract address for debugging purposes
         */
        // console.log('Contract deployed at:', tzip_12_tutorial_instance.address);
        storage = await tzip_12_tutorial_instance.storage();
    });

    describe('update operators', () => {
        describe('add operator', () => {
            it('should be able to add an operator and send when added', async () => {
                const tokenOwner = alice.pkh;
                const accountBefore = await storage.get(tokenOwner);
                assert.equal(true, Array.isArray(accountBefore.allowances)); // I couldn't find an `assert.true`

                const tokenOperator = bob.pkh;
                await tzip_12_tutorial_instance.update_operators([{
                    'add_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }]);
                const accountAfter = await storage.get(tokenOwner);
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
                const prom = tzip_12_tutorial_instance.update_operators(updateParam);
                await tzip_12_tutorial_instance.update_operators(updateParam);
                prom.then(() => {
                    storage.get(tokenOwner).then(accountAfter => {
                        assert.equal(1, accountAfter.allowances.length);
                        assert.equal(tokenOperator, accountAfter.allowances[0]);
                    });
                });

                // Call it again and ensure that nothing has changed
                await tzip_12_tutorial_instance.update_operators(updateParam);
                storage.get(tokenOwner).then(accountAfter => {
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
                await tzip_12_tutorial_instance.update_operators(addParam);

                storage.get(tokenOwner).then(accountAfter => {
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
                await tzip_12_tutorial_instance.update_operators(removeParam);
                storage.get(tokenOwner).then(accountAfter => {
                    assert.equal(0, accountAfter.allowances.length);
                });
            });
        });

        describe('remove operator', () => {
            it('should be able to add and remove an operator', async () => {
                const tokenOwner = alice.pkh;

                const tokenOperator = bob.pkh;
                await tzip_12_tutorial_instance.update_operators([{
                    'add_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }]);
                const accountMid = await storage.get(tokenOwner);
                assert.equal(1, accountMid.allowances.length);
                assert.equal(true, Array.isArray(accountMid.allowances));
                assert.equal(tokenOperator, accountMid.allowances[0]);

                const removeParam = [{
                    'remove_operator': {
                        owner: tokenOwner,
                        operator: tokenOperator
                    }
                }];
                await tzip_12_tutorial_instance.update_operators(removeParam);
                const accountAfter = await storage.get(tokenOwner);
                assert.equal(0, accountAfter.allowances.length);

                // Removing an operator should be an idempotent operation
                await tzip_12_tutorial_instance.update_operators(removeParam);
                const accountAfterAfter = await storage.get(tokenOwner);
                assert.equal(0, accountAfterAfter.allowances.length);
            });
        });
    });

    describe('update operators', () => {
        const expectedBalanceAlice = initial_storage.get(alice.pkh).balance;
        it(`should store a balance of ${expectedBalanceAlice} for Alice`, async () => {
            /**
             * Get balance for Alice from the smart contract's storage (by a big map key)
             */
            const deployedBalanceAlice = (await storage.get(alice.pkh)).balance;
            assert.equal(expectedBalanceAlice, deployedBalanceAlice);
        });

        it(`should not store any balance for Bob`, async () => {
            let accountBob = await storage.get(bob.pkh);
            assert.equal(accountBob, undefined);
        });

        it('should transfer 1 token from Alice to Bob', async () => {
            const transferParam = [
                {
                    /**
                     * token_id: 0 represents the single token_id within our contract
                     */
                    token_id: 0,
                    amount: 1,
                    from_: alice.pkh,
                    to_: bob.pkh
                }
            ];

            /**
             * Call the `transfer` entrypoint
             */
            await tzip_12_tutorial_instance.transfer(transferParam);
            /**
             * Bob's token balance should now be 1 and Alice's 9.
             */
            const deployedAccountBob = await storage.get(bob.pkh);
            const expectedBalanceBob = 1;
            assert.equal(deployedAccountBob.balance, expectedBalanceBob);

            const deployedAccountAlice = await storage.get(alice.pkh);
            const expectedBalanceAlice = 9;
            assert.equal(deployedAccountAlice.balance, expectedBalanceAlice);
        });

        it(`should not allow transfers from_ an address that did not sign the transaction`, async () => {
            const transferParam = [
                {
                    token_id: 0,
                    amount: 1,
                    from_: bob.pkh,
                    to_: alice.pkh
                }
            ];

            try {
                /**
                 * Transactions in the test suite are signed by a secret/private key
                 * configured in truffle-config.js
                 */
                await tzip_12_tutorial_instance.transfer(transferParam);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.fromEqualToSenderAddress)
            }
        });

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

            try {
                await tzip_12_tutorial_instance.transfer(transferParam);
            } catch (e) {
                assert.equal(e.message, constants.contractErrors.insufficientBalance)
            }
        });

    });
});
