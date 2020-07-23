const BigNumber = require('bignumber.js');
const fa2_wl = artifacts.require('fa2_with_whitelisting');
const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');

const { initial_storage } = require('../migrations/1_deploy_fa2_with_whitelisting.js');
const constants = require('./../helpers/constants.js');

/**
 * For testing on a babylonnet (testnet), instead of the sandbox network,
 * make sure to replace the keys for alice/bob accordingly.
 */
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');


contract('fa2_wl', _accounts => {
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

    describe('Token_metadata_registry', () => {
        it('Token_metadata_registry endpoint responds with expected address', async () => {
            assert.equal(wrapper_storage.tmr_response, bob.pkh, "wrapper storage is initiated to Bob's PKH");

            // Make method call and verify that this updates the storage of the wrapper contract
            await fa2_wl_wrapper_instance.call_token_metadata_registry(fa2_wl_instance.address);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.tmr_response, fa2_wl_instance.address, "wrapper storage is changed to the FA2 contract address as this is where the contract metadata is found");
        });
    });

    describe('balance_of', () => {
        it('balance_of should respond with expected balances', async () => {
            assert.equal(wrapper_storage.balance_responses.length, 0, "balance responses entry should be empty before call");

            // Make method call to balance_of endpoint and verify that the correct balances are returned to the caller smart contract
            var requests = [];
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses.length, 0, "balance responses entry should be empty after call with no requests");

            // Verify Alice's balance
            requests = [
                { owner: alice.pkh, token_id: 0 }
            ];
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses[0].balance, 10, "Alice's initial balance is unchanged");

            // Verify Bob's balance
            requests[0].owner = bob.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses[0].balance, 10, "Bob's initial balance is unchanged");

            // Verify Charlie's balance
            requests[0].owner = charlie.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses[0].balance, 0, "Charlie's initial balance is uninitialized and must thus be 0");

            // Verify David's balance
            requests[0].owner = david.pkh;
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses[0].balance, 2, "David's initial balance is unchanged");

            requests = [
                { owner: alice.pkh, token_id: 0 },
                { owner: bob.pkh, token_id: 0 }
            ];
            await fa2_wl_wrapper_instance.call_balance_of(fa2_wl_instance.address, requests);
            wrapper_storage = await fa2_wl_wrapper_instance.storage();
            assert.equal(wrapper_storage.balance_responses.length, 2, "Can request multiple balances");
            expect(wrapper_storage.balance_responses.map(x => x.request.owner).includes(alice.pkh)).to.be.true;
            expect(wrapper_storage.balance_responses.map(x => x.request.owner).includes(bob.pkh)).to.be.true;
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
                assert.equal(e.message, constants.contractErrors.notOperator);
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
});
