const BigNumber = require('bignumber.js');
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
const fa1_2_burn_mint = artifacts.require("fa1_2_burn_mint");
const initial_storage = require('./../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const constants = require('../../helpers/fa1_2Constants.js');

const {
    addWhitelistedsSingular,
    addWhitelisters,
    expectThrow,
    removeWhitelistedsSingular,
    removeWhitelisters,
} = require('../shared_utils.js');

contract('fa1_2_with_whitelisting', (_accounts) => {
    let storages = [];
    let wrapper_storage;
    let fa1_2_instances = [];
    let contract_names = [];

    before(async () => {
        contract_names[0] = "fa1_2_with_whitelisting";
        fa1_2_instances[0] = await fa1_2_with_whitelisting.new(initial_storage.initial_storage_fa1_2_with_whitelisting_no_whitelisted);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_instances[0].address);
        storages[0] = await fa1_2_instances[0].storage();
    });

    describe('whitelist and transfers', () => {
        it('follows the correct whitelist rules for transfers', async () => {
            for (let i = 0; i < fa1_2_instances.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                var storage = storages[i];

                await instance.update_whitelisters(addWhitelisters([alice]));

                const aliceAccountStart = await storage.ledger.get(alice.pkh);
                const bobAccountStart = await storage.ledger.get(bob.pkh);
                var trfsAmount = new BigNumber(1);
                var newTrfsAmount = new BigNumber(2);
                await expectThrow(
                    instance.transfer(alice.pkh, bob.pkh, trfsAmount),
                    constants.contractErrors.senderNotWhiteListed
                );
                var aliceAccountAfter = await storage.ledger.get(alice.pkh);
                var bobAccountAfter = await storage.ledger.get(bob.pkh);
                assert(aliceAccountStart.balance.isEqualTo(aliceAccountAfter.balance));
                assert(bobAccountStart.balance.isEqualTo(bobAccountAfter.balance));

                // Whitelist Alice and verify that the transaction still fails since
                // Bob is not whitelisted
                await instance.update_whitelisteds(addWhitelistedsSingular([alice]));
                await expectThrow(
                    instance.transfer(alice.pkh, bob.pkh, trfsAmount),
                    constants.contractErrors.receiverNotWhiteListed
                );
                aliceAccountAfter = await storage.ledger.get(alice.pkh);
                bobAccountAfter = await storage.ledger.get(bob.pkh);
                assert(aliceAccountStart.balance.isEqualTo(aliceAccountAfter.balance), "Alice's balance is unchanged after blocked transfer 1");
                assert(bobAccountStart.balance.isEqualTo(bobAccountAfter.balance), "Bob's balance is unchanged after blocked transfer 1");

                // Whitelist Bob and de-whitelist Alice and verify that transaction fails
                await instance.update_whitelisteds(removeWhitelistedsSingular([alice]));
                await instance.update_whitelisteds(addWhitelistedsSingular([bob]));
                await expectThrow(
                    instance.transfer(alice.pkh, bob.pkh, trfsAmount),
                    constants.contractErrors.senderNotWhiteListed
                );
                aliceAccountAfter = await storage.ledger.get(alice.pkh);
                bobAccountAfter = await storage.ledger.get(bob.pkh);
                assert(aliceAccountStart.balance.isEqualTo(aliceAccountAfter.balance), "Alice's balance is unchanged after blocked transfer 2");
                assert(bobAccountStart.balance.isEqualTo(bobAccountAfter.balance), "Bob's balance is unchanged after blocked transfer 2");

                // Whitelist Alice again and verify that transaction goes through
                await instance.update_whitelisteds(addWhitelistedsSingular([alice]));
                await instance.transfer(alice.pkh, bob.pkh, trfsAmount);
                aliceAccountAfter = await storage.ledger.get(alice.pkh);
                bobAccountAfter = await storage.ledger.get(bob.pkh);
                assert(aliceAccountStart.balance.minus(trfsAmount).isEqualTo(aliceAccountAfter.balance), "Alice's balance is decremented by 1");
                assert(bobAccountStart.balance.plus(trfsAmount).isEqualTo(bobAccountAfter.balance), "Bob's balance is incremented by 1");

                // Ensure that the addresses are still whitelisted and that
                // we can transfer 2 tokens
                await instance.transfer(alice.pkh, bob.pkh, newTrfsAmount);
                aliceAccountAfter = await storage.ledger.get(alice.pkh);
                bobAccountAfter = await storage.ledger.get(bob.pkh);
                assert(aliceAccountStart.balance.minus(trfsAmount).minus(newTrfsAmount).isEqualTo(aliceAccountAfter.balance), "Alice's balance is decremented by 3");
                assert(bobAccountStart.balance.plus(trfsAmount).plus(newTrfsAmount).isEqualTo(bobAccountAfter.balance), "Bob's balance is incremented by 3");

                // Verify that adding an address to whitelist is an idempotent operation
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 2);
                assert(storage.whitelisteds.includes(alice.pkh));
                assert(storage.whitelisteds.includes(bob.pkh));
                await instance.update_whitelisteds(addWhitelistedsSingular([alice]));

                storage = await instance.storage();
                assert(storage.whitelisteds.length === 2);
                assert(storage.whitelisteds.includes(alice.pkh));
                assert(storage.whitelisteds.includes(bob.pkh));

                await instance.update_whitelisteds(addWhitelistedsSingular([alice, bob]));
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 2);
                assert(storage.whitelisteds.includes(alice.pkh));
                assert(storage.whitelisteds.includes(bob.pkh));

                await instance.update_whitelisteds(addWhitelistedsSingular([bob]));
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 2);
                assert(storage.whitelisteds.includes(alice.pkh));
                assert(storage.whitelisteds.includes(bob.pkh));

                await instance.update_whitelisteds(removeWhitelistedsSingular([alice]));
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 1);
                assert(storage.whitelisteds.includes(bob.pkh));

                await instance.update_whitelisteds(removeWhitelistedsSingular([alice]));
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 1);
                assert(storage.whitelisteds.includes(bob.pkh));

                await instance.update_whitelisteds(removeWhitelistedsSingular([bob]));
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 0);

                // Cannot whitelist when is not whitelister
                await instance.update_whitelisters(removeWhitelisters([alice]));
                await expectThrow(
                    instance.update_whitelisteds(addWhitelistedsSingular([alice])),
                    constants.contractErrors.onlyWlrCanAddWld
                );
                await expectThrow(
                    instance.update_whitelisteds(addWhitelistedsSingular([bob])),
                    constants.contractErrors.onlyWlrCanAddWld
                );
                storage = await instance.storage();
                assert(storage.whitelisteds.length === 0);
                assert(storage.whitelisters.length === 0);
            }
        });
    });
});
