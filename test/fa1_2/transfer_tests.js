const fa1_2_basic = artifacts.require("fa1_2_basic");

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const constants = require('../../helpers/fa1_2Constants.js');

const {
    expectThrow,
} = require('../shared_utils.js');

contract('fa1_2_basic', (_accounts) => {
    let storage;
    let fa1_2_basic_instance;

    before(async () => {
        fa1_2_basic_instance = await fa1_2_basic.deployed();

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_basic_instance.address);
        storage = await fa1_2_basic_instance.storage();
    });

    describe('transfer', () => {
        it('should be able to send from own address', async () => {
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            assert.equal(aliceBefore.balance, 10, "Alice's intial balance is 10");
            assert.equal(bobBefore.balance, 10, "Bob's intial balance is 10");
            await fa1_2_basic_instance.transfer(alice.pkh, bob.pkh, 1);
            var aliceAfter = await storage.ledger.get(alice.pkh);
            var bobAfter = await storage.ledger.get(bob.pkh);
            assert.equal(aliceAfter.balance, 9, "Alice lost one");
            assert.equal(bobAfter.balance, 11, "Bob gained one");
        });

        it('should be able to send to self', async () => {
            const aliceBefore = await storage.ledger.get(alice.pkh);
            await fa1_2_basic_instance.transfer(alice.pkh, alice.pkh, 1);
            var aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 1 to self");

            // Sending two to self has same effect as sending 1
            await fa1_2_basic_instance.transfer(alice.pkh, alice.pkh, 2);
            aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 2 to self");

            // Sending zero to self has same effect as sending 1
            await fa1_2_basic_instance.transfer(alice.pkh, alice.pkh, 0);
            aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 0 to self");
        });

        it('should not be able to send more than balance', async () => {
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            await expectThrow(
                fa1_2_basic_instance.transfer(alice.pkh, bob.pkh, 11),
                constants.contractErrors.insufficientBalance
            );
            var aliceAfter = await storage.ledger.get(alice.pkh);
            var bobAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Alice's balance must be unaffected by failed call to transfer");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance), "Bob's balance must be unaffected by failed call to transfer");
        });
    });
});
