const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob} = require('./../scripts/sandbox/accounts');


contract('fa2_wl', _accounts => {
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
        console.log('Wrapper contract deployed at:', fa2_wl_wrapper_instance.address);
        storage = await fa2_wl_instance.storage();
        wrapper_storage = await fa2_wl_wrapper_instance.storage();
    });

    describe('update operators', () => {
        describe('add operator', () => {
            // FIXME: Swap owner and operator, add expectThrows and fix error message
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
                    assert.equal(error.message, constants.contractErrors.notOperator);
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
});