const BigNumber = require('bignumber.js');
const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const {
    initial_storage,
} = require('../../migrations/1_deploy_fa2_with_whitelisting.js');
const constants = require('../../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, david } = require('../../scripts/sandbox/accounts');
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

    describe('transfer and balances', () => {
        const expectedBalanceAlice = initial_storage.ledger.get(alice.pkh)
            .balances.get('0');
        const expectedBalanceBob = initial_storage.ledger.get(bob.pkh).balances.get('0');
        it(`should store a balance of ${expectedBalanceAlice} for Alice and ${expectedBalanceBob} for Bob`, async () => {
            /**
             * Get balance for Alice from the smart contract's storage (by a big map key)
             */
            const deployedAccountAliceProm = storage.ledger.get(alice.pkh);
            const deployedAccountBob = await storage.ledger.get(bob.pkh);
            deployedAccountAliceProm.then((alice) => {
                assert.equal(alice.balances.get('0'), expectedBalanceAlice);
                assert.equal(deployedAccountBob.balances.get('0'), expectedBalanceBob);
            });
        });

        it('should allow transfer requests with empty list as input', async () => {
            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            await fa2_wl_instance.transfer(transferParams([]));
            const accountAliceAfter = await storage.ledger.get(alice.pkh);

        });

        it('should transfer 1 token from Alice to Bob', async () => {
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            const accountAliceBefore = await storage.ledger.get(alice.pkh);

            // Add Alice and Bob to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob])
            );

            // Verify that transactions with 0 amount are possible, and that they
            // do not affect balances (part of FA2 spec that this must pass)
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 0]] }])
            );
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(accountAliceBefore.balances.get('0'))
            );
            assert(accountBobAfter.balances.get('0').isEqualTo(accountBobBefore.balances.get('0')));

            // Verify that Alice can send to herself. It is a part of the FA2 spec
            // that this must pass. Verify this for both 0 amount and 1 amount
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[alice, 0]] }])
            );
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(accountAliceBefore.balances.get('0'))
            );
            assert(accountBobAfter.balances.get('0').isEqualTo(accountBobBefore.balances.get('0')));

            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[alice, 1]] }])
            );

            // Verify that no balances are updated
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(accountAliceBefore.balances.get('0'))
            );
            assert(accountBobAfter.balances.get('0').isEqualTo(accountBobBefore.balances.get('0')));

            // Verify that 1 token can be transferred from Alice to Bob
            const amount = 1;
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, amount]] }])
            );
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0').minus(amount)
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0').plus(amount)
                )
            );

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('should not allow transfers from an address that did not sign the transaction and that has not been made operator', async () => {
            // Add Alice and Bob to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob])
            );

            let accountBobBefore;
            let accountAliceBefore;
            let accountBobAfter;
            let accountAliceAfter;
            /**
             * Transactions in the test suite are signed by a secret/private key
             * configured in truffle-config.js
             */
            accountBobBefore = await storage.ledger.get(bob.pkh);
            accountAliceBefore = await storage.ledger.get(alice.pkh);

            // Ensure that Bob has the necessary balance making the transfer to ensure that we are testing
            // the right thing
            const amount = 5;
            assert(
                accountBobBefore.balances.get('0').isGreaterThanOrEqualTo(
                    new BigNumber(amount)
                )
            );

            expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: bob, to: [[alice, amount]] }])
                ),
                constants.contractErrors.notOperator
            );
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(accountBobBefore.balances.get('0').isEqualTo(accountBobAfter.balances.get('0')));
            assert(
                accountAliceBefore.balances.get('0').isEqualTo(accountAliceAfter.balances.get('0'))
            );

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('should allow an address in the allowances list to withdraw from an account', async () => {
            // This works since Alice is part of David's `allowances` list in `initial_storage`

            // Add Alice, Bob and David to whitelisteds. Since the transactions originate from Alice's address,
            // she must first add herself as whitelister so she can whitelist herself and whitelist Bob.
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob, david])
            );

            // Verify that 1 can be withdrawn as this is David's balance
            var accountDavid = await storage.ledger.get(david.pkh);
            assert(accountDavid.balances.get('0').isEqualTo(new BigNumber(2)));
            // Alice's balance at this point is 9
            await fa2_wl_instance.transfer(
                transferParams([{ from: david, to: [[alice, 1]] }])
            );
            accountDavid = await storage.ledger.get(david.pkh);
            assert(accountDavid.balances.get('0').isEqualTo(new BigNumber(1)));

            // Transfer 1 from David to Bob
            accountDavid = await storage.ledger.get(david.pkh);
            await fa2_wl_instance.transfer(
                transferParams([{ from: david, to: [[bob, 1]] }])
            );
            accountDavid = await storage.ledger.get(david.pkh);
            assert(accountDavid.balances.get('0').isEqualTo(new BigNumber(0)));

            // Disallow another transaction since David's balance is now 0
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: david, to: [[bob, 1]] }])
                ),
                constants.contractErrors.insufficientBalance
            );

            // Transfer back some coins for test below
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[david, 1]] }])
            );

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob, david])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('multi-transfer should succeed if balance is sufficient or else fail completely', async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob, david])
            );
            let accountBobBefore = await storage.ledger.get(bob.pkh);
            let accountAliceBefore = await storage.ledger.get(alice.pkh);
            await fa2_wl_instance.transfer(
                transferParams([
                    {
                        from: alice,
                        to: [
                            [bob, 1],
                            [bob, 2],
                        ],
                    },
                ])
            );
            let accountBobAfter = await storage.ledger.get(bob.pkh);
            let accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0').minus(3)
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0').plus(3)
                )
            );
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([
                        {
                            from: alice,
                            to: [
                                [bob, 1],
                                [bob, 20],
                            ],
                        },
                    ])
                ),
                constants.contractErrors.insufficientBalance
            );
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([
                        {
                            from: alice,
                            to: [
                                [bob, 20],
                                [bob, 1],
                            ],
                        },
                    ])
                ),
                constants.contractErrors.insufficientBalance
            );
            let accountAliceAfterFail = await storage.ledger.get(alice.pkh);
            let accountBobAfterFail = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceAfterFail.balances.get('0')
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(accountBobAfterFail.balances.get('0'))
            );

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob, david])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('outer-multi-transfer should succeed if balance is sufficient or else fail completely', async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob, david])
            );
            let accountAliceBefore = await storage.ledger.get(alice.pkh);
            let accountBobBefore = await storage.ledger.get(bob.pkh);
            let accountDavidBefore = await storage.ledger.get(david.pkh);
            await fa2_wl_instance.transfer(
                transferParams([
                    {
                        from: alice,
                        to: [
                            [bob, 1],
                        ],
                    },
                    {
                        from: david,
                        to: [
                            [bob, 1],
                        ],
                    },
                ])
            );
            let accountAliceAfter = await storage.ledger.get(alice.pkh);
            let accountBobAfter = await storage.ledger.get(bob.pkh);
            let accountDavidAfter = await storage.ledger.get(david.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0').minus(1)
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0').plus(2)
                )
            );
            assert(
                accountDavidAfter.balances.get('0').isEqualTo(
                    accountDavidBefore.balances.get('0').minus(1)
                )
            );
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([
                        {
                            from: alice,
                            to: [
                                [bob, 1],
                            ],
                        },
                        {
                            from: david,
                            to: [
                                [bob, 20],
                            ],
                        },
                    ])
                ),
                constants.contractErrors.insufficientBalance
            );
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([
                        {
                            from: alice,
                            to: [
                                [bob, 20],
                            ],
                        },
                        {
                            from: david,
                            to: [
                                [bob, 1],
                            ],
                        },
                    ])
                ),
                constants.contractErrors.insufficientBalance
            );
            let accountAliceAfterFail = await storage.ledger.get(alice.pkh);
            let accountBobAfterFail = await storage.ledger.get(bob.pkh);
            let accountDavidAfterFail = await storage.ledger.get(david.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceAfterFail.balances.get('0')
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(accountBobAfterFail.balances.get('0'))
            );
            assert(
                accountDavidAfter.balances.get('0').isEqualTo(accountDavidAfterFail.balances.get('0'))
            );

            // Remove Alice and Bob from whitelisted. This must be done in the opposite
            // order of how they were added
            // Done to keep state of test runtime unaffected from this test
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob, david])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it("should not transfer tokens from Alice to Bob when Alice's balance is insufficient", async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob])
            );

            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: alice, to: [[bob, 100]] }])
                ),
                constants.contractErrors.insufficientBalance
            );

            // Change amount and verify that it works
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 1]] }])
            );
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0').minus(1)
                )
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0').plus(1)
                )
            );

            // Verify that balances of token_id = 1 has not changed
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1')
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1')
                )
            );

            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('should disallow transfers of unrecognized tokens', async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));

            // Whitelist Alice and Bob for all relevant tokens
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob], 2)
            );
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob], 1)
            );
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob], 0)
            );

            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: alice, to: [[bob, 1]] }], 2)
                ),
                constants.contractErrors.unknownTokenId
            );

            // Verify that transfers of token_id = 1 works since this is a registered asset in the contract
            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 1]] }], 1)
            );

            // Verify that balance of token_id = 1 is changed, and that balance
            // of token_id = 0 is unchanged
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1').minus(1)
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1').plus(1)
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0'))
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0'))
            );

            // Transfer 2 units and verify that this also works
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 2]] }], 1)
            );
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1').minus(3)
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1').plus(3)
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0'))
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0'))
            );

            // Transfer more than is available and verify that this is not possible
            // and that this does not affect balances
            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: alice, to: [[bob, 4], [bob, 4]] }], 1)
                ),
                constants.contractErrors.insufficientBalance
            );
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1').minus(3)
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1').plus(3)
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0'))
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0'))
            );

            // Remove Alice and Bob from the tokens for which they were whitelisted
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob], 0)
            );
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob], 1)
            );
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob], 2)
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });

        it('should not allow transfer when whitelisted for wrong token_id', async () => {
            await fa2_wl_instance.update_whitelisters(addWhitelisters([alice]));

            // Whitelist Alice and Bob for token_id = 1, attempt to transfer token_id = 0
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob], 1)
            );

            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            const accountBobBefore = await storage.ledger.get(bob.pkh);

            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: alice, to: [[bob, 1]] }], 0)
                ),
                constants.contractErrors.senderNotWhitelisted
            );

            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            var accountBobAfter = await storage.ledger.get(bob.pkh);

            // Verify that nothing was transferred
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1')
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1')
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0'))
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0'))
            );

            // Transfer 1 unit of token_id = 1 and verify that this works
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 1]] }], 1)
            );
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1').minus(1)
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1').plus(1)
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0'))
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0'))
            );

            // Whitelist Alice and Bob for token_id = 0, and verify that transfer of token_id = 0 is now allowed
            await fa2_wl_instance.update_whitelisteds(
                addWhitelisteds([alice, bob], 0)
            );
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 1]] }], 0)
            );
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balances.get('1').isEqualTo(
                    accountAliceBefore.balances.get('1').minus(1)
                )
            );
            assert(
                accountBobAfter.balances.get('1').isEqualTo(
                    accountBobBefore.balances.get('1').plus(1)
                )
            );
            assert(
                accountAliceAfter.balances.get('0').isEqualTo(
                    accountAliceBefore.balances.get('0').minus(1)), "Alice's balance is reduced"
            );
            assert(
                accountBobAfter.balances.get('0').isEqualTo(
                    accountBobBefore.balances.get('0').plus(1)), "Bob's balance is increased"
            );

            // Reset whitelisteds value
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob], 1)
            );
            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob], 0)
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });
    });
});
