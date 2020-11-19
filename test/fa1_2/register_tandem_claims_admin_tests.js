const BigNumber = require('bignumber.js');
const fa1_2_kiss = artifacts.require("fa1_2_kiss");
const fa1_2_kiss_activity_log = artifacts.require("fa1_2_kiss_activity");
const initial_storage = require('../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const {
    expectThrow,
} = require('../shared_utils.js');

contract('fa1_2_kiss', (_accounts) => {
    let storage;
    let instance;

    before(async () => {
        contract_name = "fa1_2_kiss";
        instance = await fa1_2_kiss.new(initial_storage.initial_storage_fa1_2_kiss);
        initial_storage.initial_storage_fa1_2_kiss_activity_log.admin = instance.address;
        activity_instance = await fa1_2_kiss_activity_log.new(initial_storage.initial_storage_fa1_2_kiss_activity_log);

        // Update instance storage with the correct address for activity log
        await instance.change_activity_log(activity_instance.address);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 KISS contract deployed at:', instance.address);
        console.log('FA1.2 KISS activity log contract deployed at:', activity_instance.address);
        storage = await instance.storage();
        activity_storage = await activity_instance.storage();
    });

    describe('Initialization test', () => {
        it('has the correct activity log address', async () => {
            assert.equal(storage.external_contract_address, activity_instance.address, 'Should have stored correct activity log address');
            assert.equal(instance.address, activity_storage.admin, 'FA1.2 contract should be administrator of activity log');
        });
    });

    describe('admin reistration of tandem claims', () => {
        it('should be able to register an admin tandem claim and exchange minutes based on this', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh],
                helpees: { admin_helpee: [alice.pkh]},
                activities: [0],
                minutes: 60,
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(120)), "Alice's intial balance is 120");
            assert(bobBefore.balance.isEqualTo(new BigNumber(10)), "Bob's intial balance is 10");
            await instance.register_tandem_claims([adminTandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(60)), "Alice's new balance is 60");
            assert(bobAfter.balance.isEqualTo(new BigNumber(70)), "Bob's new balance is 70");

            // Verify that activity is logged correctly
            activity_storage = await activity_instance.storage();
            assert(activity_storage.activity_balance.get('0').isEqualTo(new BigNumber(60)));
        });

        it('should treat same helper and helpee as a nop for balances', async () => {
            var adminTandemClaim = {
                helpers: [alice.pkh],
                helpees: { admin_helpee: [alice.pkh]},
                activities: [0],
                minutes: 3,
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(60)), "Alice's balance before call is 60");
            await instance.register_tandem_claims([adminTandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(60)), "Alice's balance is unaffected by an admin claim");
        });

        it('should be able to handle multiple helpees', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh, charlie.pkh, david.pkh],
                helpees: { admin_helpee: [alice.pkh]},
                activities: [1],
                minutes: 9,
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([adminTandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.minus(new BigNumber(9))), "Alice paid 9 minutes for help");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(3))), "Bob got 3 minutes for help");
            assert(charlieAfter.balance.isEqualTo(new BigNumber(3)), "Charlie got 3 minutes for help"); // Charlie does not have an entry in storage prior to call to endpoint
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.plus(new BigNumber(3))), "David got 3 minutes for help");

            // Verify that activity is logged correctly
            activity_storage = await activity_instance.storage();
            assert(activity_storage.activity_balance.get('1').isEqualTo(new BigNumber(9)));
        });

        it('should be able to handle multiple helpers', async () => {
            var adminTandemClaim = {
                helpers: [alice.pkh],
                helpees: { admin_helpee: [bob.pkh, charlie.pkh, david.pkh] },
                activities: [0],
                minutes: 9,
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([adminTandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.plus(new BigNumber(9))), "Alice got 9 minutes for help");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.minus(new BigNumber(3))), "Bob got 3 minutes for help");
            assert(charlieAfter.balance.isEqualTo(charlieBefore.balance.minus(new BigNumber(3))), "Charlie got 3 minutes for help");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.minus(new BigNumber(3))), "David got 3 minutes for help");
        });

        it('should be able to handle multiple helpees *and* multiple helpers', async () => {
            var adminTandemClaim = {
                helpers: [alice.pkh, bob.pkh],
                helpees: { admin_helpee: [charlie.pkh, david.pkh] },
                activities: [0],
                minutes: 10,
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([adminTandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.plus(new BigNumber(5))), "Alice got 5 minutes for help");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(5))), "Bob got 5 minutes for help");
            assert(charlieAfter.debit.isEqualTo(new BigNumber(5)), "Charlie spent 5 minutes for help"); // Charlie does not have an entry in storage prior to call to endpoint
            assert(davidBefore.debit.isEqualTo(new BigNumber(0)), "David spent 5 minutes for help, debit number before");
            assert(davidBefore.balance.isEqualTo(new BigNumber(2)), "David spent 5 minutes for help, balance number before");
            assert(davidAfter.debit.isEqualTo(new BigNumber(3)), "David spent 5 minutes for help, debit number after");
            assert(davidAfter.balance.isEqualTo(new BigNumber(0)), "David spent 5 minutes for help, balance number after");
        });

        it('should be able to handle the empty claim', async () => {
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Alice's balance is unaffected");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance), "Bob's balance is unaffected");
            assert(charlieAfter.balance.isEqualTo(charlieBefore.balance), "Charlie's balance is unaffected");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance), "David's balance is unaffected");
            assert(aliceAfter.debit.isEqualTo(aliceBefore.debit), "Alice's debit is unaffected");
            assert(bobAfter.debit.isEqualTo(bobBefore.debit), "Bob's debit is unaffected");
            assert(charlieAfter.debit.isEqualTo(charlieBefore.debit), "Charlie's debit is unaffected");
            assert(davidAfter.debit.isEqualTo(davidBefore.debit), "David's debit is unaffected");
        });

        it('should fail on inconistent minutes/helpers length', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh, alice.pkh],
                helpees: { admin_helpee: [charlie.pkh] },
                activities: [0],
                minutes: 3,
            };
            await expectThrow(instance.register_tandem_claims([adminTandemClaim]), "INCONSISTENT_MINUTES_PER_RECIPIENT");
            adminTandemClaim.minutes = 2;
            await instance.register_tandem_claims([adminTandemClaim]);
        });

        it('should fail on inconistent minutes/helpees length', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh],
                helpees: { admin_helpee: [charlie.pkh, alice.pkh] },
                activities: [0],
                minutes: 3,
            };
            await expectThrow(instance.register_tandem_claims([adminTandemClaim]), "INCONSISTENT_MINUTES_PER_SENDER");
            adminTandemClaim.minutes = 2;
            await instance.register_tandem_claims([adminTandemClaim]);
        });

        it('should fail on unregistered activities', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh],
                helpees: { admin_helpee: [alice.pkh] },
                activities: [3],
                minutes: 1,
            };
            await expectThrow(instance.register_tandem_claims([adminTandemClaim]), "UNKNOWN_ACTIVITY");
        });

        it('should fail on suspended activities', async () => {
            await instance.call_suspend_allowed_activity(2);
            var adminTandemClaim = {
                helpers: [bob.pkh],
                helpees: { admin_helpee: [alice.pkh] },
                activities: [2],
                minutes: 1,
            };
            await expectThrow(instance.register_tandem_claims([adminTandemClaim]), "ACTIVITY_SUSPENDED");
        });

        it('should only allow admin to call the admin endpoint', async () => {
            var adminTandemClaim = {
                helpers: [bob.pkh],
                helpees: { admin_helpee: [alice.pkh] },
                activities: [0],
                minutes: 1,
            };
            await instance.register_tandem_claims([adminTandemClaim]);

            storage = await instance.storage();
            assert.equal(storage.admin, alice.pkh);

            // Make Bob admin and verify that a tandem cannot be registered by Alice through the admin endpoint
            await instance.change_admin_this(bob.pkh);
            storage = await instance.storage();
            assert.equal(storage.admin, bob.pkh);
            await expectThrow(instance.register_tandem_claims([adminTandemClaim]), "CALLER_NOT_ADMIN");
        });
    });
});
