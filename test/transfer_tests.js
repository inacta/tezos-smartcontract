const BigNumber = require('bignumber.js');
const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const {
    initial_storage,
} = require('../migrations/1_deploy_fa2_with_whitelisting.js');
const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, david } = require('./../scripts/sandbox/accounts');
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
            .balance;
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
                accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)
            );
            assert(accountBobAfter.balance.isEqualTo(accountBobBefore.balance));

            // Verify that Alice can send to herself. It is a part of the FA2 spec
            // that this must pass. Verify this for both 0 amount and 1 amount
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[alice, 0]] }])
            );
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)
            );
            assert(accountBobAfter.balance.isEqualTo(accountBobBefore.balance));

            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[alice, 1]] }])
            );
            accountBobAfter = await storage.ledger.get(bob.pkh);
            accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balance.isEqualTo(accountAliceBefore.balance)
            );
            assert(accountBobAfter.balance.isEqualTo(accountBobBefore.balance));

            // Verify that 1 token can be transferred from Alice to Bob
            const amount = 1;
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, amount]] }])
            );
            var accountBobAfter = await storage.ledger.get(bob.pkh);
            var accountAliceAfter = await storage.ledger.get(alice.pkh);
            assert(
                accountAliceAfter.balance.isEqualTo(
                    accountAliceBefore.balance.minus(amount)
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(
                    accountBobBefore.balance.plus(amount)
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
                accountBobBefore.balance.isGreaterThanOrEqualTo(
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
            assert(accountBobBefore.balance.isEqualTo(accountBobAfter.balance));
            assert(
                accountAliceBefore.balance.isEqualTo(accountAliceAfter.balance)
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
            assert(accountDavid.balance.isEqualTo(new BigNumber(2)));
            // Alice's balance at this point is 9
            await fa2_wl_instance.transfer(
                transferParams([{ from: david, to: [[alice, 1]] }])
            );
            accountDavid = await storage.ledger.get(david.pkh);
            assert(accountDavid.balance.isEqualTo(new BigNumber(1)));

            // Transfer 1 from David to Bob
            accountDavid = await storage.ledger.get(david.pkh);
            await fa2_wl_instance.transfer(
                transferParams([{ from: david, to: [[bob, 1]] }])
            );
            accountDavid = await storage.ledger.get(david.pkh);
            assert(accountDavid.balance.isEqualTo(new BigNumber(0)));

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
                accountAliceAfter.balance.isEqualTo(
                    accountAliceBefore.balance.minus(3)
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(
                    accountBobBefore.balance.plus(3)
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
                accountAliceAfter.balance.isEqualTo(
                    accountAliceAfterFail.balance
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(accountBobAfterFail.balance)
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
                accountAliceAfter.balance.isEqualTo(
                    accountAliceBefore.balance.minus(1)
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(
                    accountBobBefore.balance.plus(2)
                )
            );
            assert(
                accountDavidAfter.balance.isEqualTo(
                    accountDavidBefore.balance.minus(1)
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
                accountAliceAfter.balance.isEqualTo(
                    accountAliceAfterFail.balance
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(accountBobAfterFail.balance)
            );
            assert(
                accountDavidAfter.balance.isEqualTo(accountDavidAfterFail.balance)
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

            await expectThrow(
                fa2_wl_instance.transfer(
                    transferParams([{ from: alice, to: [[bob, 100]] }])
                ),
                constants.contractErrors.insufficientBalance
            );

            // Change amount and verify that it works
            const accountAliceBefore = await storage.ledger.get(alice.pkh);
            const accountBobBefore = await storage.ledger.get(bob.pkh);
            await fa2_wl_instance.transfer(
                transferParams([{ from: alice, to: [[bob, 1]] }])
            );
            const accountAliceAfter = await storage.ledger.get(alice.pkh);
            const accountBobAfter = await storage.ledger.get(bob.pkh);
            assert(
                accountAliceAfter.balance.isEqualTo(
                    accountAliceBefore.balance.minus(1)
                )
            );
            assert(
                accountBobAfter.balance.isEqualTo(
                    accountBobBefore.balance.plus(1)
                )
            );

            await fa2_wl_instance.update_whitelisteds(
                removeWhitelisteds([alice, bob])
            );
            await fa2_wl_instance.update_whitelisters(
                removeWhitelisters([alice])
            );
        });
    });
});
