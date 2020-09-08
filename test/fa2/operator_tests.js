const fa2_pwl = artifacts.require('fa2_with_particular_whitelisting');
const fa2_uwl = artifacts.require('fa2_with_universal_whitelisting');
const initial_storage = require('./../../helpers/storage');
const constants = require('../../helpers/fa2Constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob } = require('../../scripts/sandbox/accounts');
const { expectThrow } = require("../shared_utils.js");
function addOperators(tuple_list) {
    return tuple_list.map(function (x) {
        return { add_operator: { owner: x[0], operator: x[1] } };
    });
}

function removeOperators(tuple_list) {
    return tuple_list.map(function (x) {
        return { remove_operator: { owner: x[0], operator: x[1] } };
    });
}

contract('fa2_pwl + fa2_uwl', (_accounts) => {
    let storages = [];
    let fa2_instances = [];
    let contract_names = [];

    before(async () => {
        fa2_instances[0] = await fa2_pwl.new(initial_storage.initial_storage_fa2_pwl);
        fa2_instances[1] = await fa2_uwl.new(initial_storage.initial_storage_fa2_uwl);
        contract_names[0] = "FA2 with particular whitelisting";
        contract_names[1] = "FA2 with universal whitelisting";

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA2 PWL deployed at:', fa2_instances[0].address);
        console.log('FA2 UWL deployed at:', fa2_instances[1].address);
        storages[0] = await fa2_instances[0].storage();
        storages[1] = await fa2_instances[1].storage();
    });

    describe('update operators', () => {
        describe('add operator', () => {
            it('should not be allowed to add an operator for an address where the transaction is not originating', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];

                    const tokenOwner = bob.pkh;
                    const tokenOperator = alice.pkh;
                    await expectThrow(
                        instance.update_operators(
                            addOperators([[tokenOwner, tokenOperator]]),
                            constants.contractErrors.approveOnBehalfOfOthers
                        )
                    );
                }
            });

            it('should be able to add an operator', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];

                    const tokenOwner = alice.pkh;
                    const tokenOperator = bob.pkh;
                    const accountBefore = await storage.ledger.get(tokenOwner);
                    assert.equal(0, accountBefore.allowances.length);

                    await instance.update_operators(
                        addOperators([[tokenOwner, tokenOperator]])
                    );
                    const accountAfter = await storage.ledger.get(tokenOwner);
                    assert.equal(1, accountAfter.allowances.length);
                    assert.equal(bob.pkh, accountAfter.allowances[0]);

                // TODO: Verify that bob can now spend from Alice's account
                }
            });

            it('adding an operator should be an idempotent operation', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];

                    const tokenOwner = alice.pkh;
                    const tokenOperator = bob.pkh;
                    // Call update_operators twice and ensure that only one entry has been made
                    const prom = instance.update_operators(
                        addOperators([[tokenOwner, tokenOperator]])
                    );
                    await instance.update_operators(
                        addOperators([[tokenOwner, tokenOperator]])
                    );
                    prom.then(() => {
                        storage.ledger.get(tokenOwner).then((accountAfter) => {
                            assert.equal(1, accountAfter.allowances.length);
                            assert.equal(tokenOperator, accountAfter.allowances[0]);
                        });
                    });

                    // Call it again and ensure that nothing has changed
                    await instance.update_operators(
                        addOperators([[tokenOwner, tokenOperator]])
                    );
                    storage.ledger.get(tokenOwner).then((accountAfter) => {
                        assert.equal(1, accountAfter.allowances.length);
                        assert.equal(tokenOperator, accountAfter.allowances[0]);
                    });
                }
            });

            it('should be able to add and remove multiple allowances in one call', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];

                    const tokenOwner = alice.pkh;
                    const tokenOperator0 = bob.pkh;
                    const tokenOperator1 = 'tz1PueLmqFpGmSNboPXvxDs6Th49xKwJfNAQ'; // random address found on Carthage net
                    await instance.update_operators(
                        addOperators([
                            [tokenOwner, tokenOperator0],
                            [tokenOwner, tokenOperator1],
                        ])
                    );

                    storage.ledger.get(tokenOwner).then((accountAfter) => {
                        assert.equal(2, accountAfter.allowances.length);
                        assert.equal(
                            true,
                            accountAfter.allowances.includes(tokenOperator0)
                        );
                        assert.equal(
                            true,
                            accountAfter.allowances.includes(tokenOperator1)
                        );
                    });
                    await instance.update_operators(
                        removeOperators([
                            [tokenOwner, tokenOperator0],
                            [tokenOwner, tokenOperator1],
                        ])
                    );
                    storage.ledger.get(tokenOwner).then((accountAfter) => {
                        assert.equal(0, accountAfter.allowances.length);
                    });

                    // Removing the operators again should be the unit identity operator as remove should be idempotent
                    await instance.update_operators(
                        removeOperators([
                            [tokenOwner, tokenOperator0],
                            [tokenOwner, tokenOperator1],
                        ])
                    );
                    storage.ledger.get(tokenOwner).then((accountAfter) => {
                        assert.equal(0, accountAfter.allowances.length);
                    });
                }
            });
        });

        describe('remove operator', () => {
            it('should be able to add and remove an operator', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];

                    const tokenOwner = alice.pkh;
                    const tokenOperator = bob.pkh;
                    await instance.update_operators(
                        addOperators([[tokenOwner, tokenOperator]])
                    );
                    const accountMid = await storage.ledger.get(tokenOwner);
                    assert.equal(1, accountMid.allowances.length);
                    assert.equal(true, Array.isArray(accountMid.allowances));
                    assert.equal(tokenOperator, accountMid.allowances[0]);

                    await instance.update_operators(
                        removeOperators([[tokenOwner, tokenOperator]])
                    );
                    const accountAfter = await storage.ledger.get(tokenOwner);
                    assert.equal(0, accountAfter.allowances.length);

                    // Removing an operator should be an idempotent operation
                    await instance.update_operators(
                        removeOperators([[tokenOwner, tokenOperator]])
                    );
                    const accountAfterAfter = await storage.ledger.get(tokenOwner);
                    assert.equal(0, accountAfterAfter.allowances.length);
                }
            });
        });
    });
});
