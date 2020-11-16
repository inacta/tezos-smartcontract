const BigNumber = require('bignumber.js');
const { InMemorySigner } = require('@taquito/signer');
const fa1_2_kiss = artifacts.require("fa1_2_kiss");
const fa1_2_kiss_activity_log = artifacts.require("fa1_2_kiss_activity");
const initial_storage = require('../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const {
    expectThrow,
} = require('../shared_utils.js');

const {
    packAddress,
    packAddressSet,
    packFourTupleAsLeftBalancedPairs,
    toHexString,
} = require('./util.js');

contract('fa1_2_kiss', (_accounts) => {
    let storage;
    let instance;
    let contract_name;

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

    describe('serialization test', () => {
        it('serializes addresses correct', async () => {
            // expected value found by running the LIGO interpreter through the CLI: ligo interpret -s pascaligo 'Bytes.pack(set [ ("tz3gN8NTLNLJg5KRsUU47NHNVHbdhcFXjjaB":address); ("tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9" : address); ("tz3LVUdDQnwsyriBSBzhu6H5H27G4mhyPN4c":address);("tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5":address);("tz1PgQt52JMirBUhhkq1eanX8hVd1Fsg71Lr":address);("tz1PgkWZdr5Vcbb3CbhubheYuEGpxJtKDMhT":address)  ])'
            assert.equal(toHexString(packAddressSet([
                'tz3gN8NTLNLJg5KRsUU47NHNVHbdhcFXjjaB',
                'tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9',
                'tz3LVUdDQnwsyriBSBzhu6H5H27G4mhyPN4c',
                'tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5',
                'tz1PgQt52JMirBUhhkq1eanX8hVd1Fsg71Lr',
                'tz1PgkWZdr5Vcbb3CbhubheYuEGpxJtKDMhT',])),
                "02000000a20a0000001600002c53db7aecca6f18483100307e674fdab364d6ce0a0000001600002c643e3360d7701c3f780e58384085594a2e938a0a000000160000a31e81ac3425310e3274a4698a793b2839dc0afa0a00000016000201c89edcf76c0f758331d715b412f5d1a048fafa0a0000001600026fde46af0356a0476dae4e4600172dc9309b3aa40a000000160002dbc751212b8750586a65d528256916795112edc9");

            // Verify that originated accounts (KT1...) and implicit accounts (tz...) are ordered correctly
            assert.equal(toHexString(packAddressSet([
                'KT1CSYNJ6dFcnsV4QJ6HnBFtdif8LJGPQiDM',
                'tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9',])),
                "02000000360a000000160000a31e81ac3425310e3274a4698a793b2839dc0afa0a00000016012a5228941252ef7e152e6374810664778d556ff300");
            assert.equal(toHexString(packAddressSet([
                'tz1aWXP237BLwNHJcCD4b3DutCevhqq2T1Z9',
                'KT1CSYNJ6dFcnsV4QJ6HnBFtdif8LJGPQiDM',])),
                "02000000360a000000160000a31e81ac3425310e3274a4698a793b2839dc0afa0a00000016012a5228941252ef7e152e6374810664778d556ff300");
        });
    });

    describe('approve', () => {
        it('should be able to register a signed tandem claim and exchange minutes based on this', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh) || new BigNumber(0);
            let aliceNonceNumber = aliceNonce.toNumber();

            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(60),
                [new BigNumber(0)],
                [bob.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 60,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(120)), "Alice's intial balance is 120");
            assert(bobBefore.balance.isEqualTo(new BigNumber(10)), "Bob's intial balance is 10");
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(60)), "Alice's new balance is 60");
            assert(bobAfter.balance.isEqualTo(new BigNumber(70)), "Bob's new balance is 70");

            // Verify that storage in the activity recording contract has also been updated
        });

        it('should be a nop to register tandem for self', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh) || new BigNumber(0);
            let aliceNonceNumber = aliceNonce.toNumber();

            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [alice.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [alice.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(60)), "Alice starts with 60");
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(60)), "balance is unaffected when registering tandem for self");
        });

        it('Should allow negative balances when calling the register_tandem_claims endpoint', async () => {
            let bobSk = new InMemorySigner(bob.sk);
            let bobNonce = await storage.nonces.get(bob.pkh) || new BigNumber(0);
            let bobNonceNumber = bobNonce.toNumber();

            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(71),
                [new BigNumber(0)],
                [alice.pkh]);
            var signature = await bobSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [alice.pkh],
                activities: [0],
                minutes: 71,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }]},
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(60)), "Alice's intial balance is 60");
            assert(bobBefore.balance.isEqualTo(new BigNumber(70)), "Bob's intial balance is 70");
            assert(bobBefore.debit.isEqualTo(new BigNumber(0)), "Bob's intial debit is 0");
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(131)), "Alice's new balance is 131");
            assert(bobAfter.balance.isEqualTo(new BigNumber(0)), "Bob's new balance is 0");
            assert(bobAfter.debit.isEqualTo(new BigNumber(1)), "Bob's new debit is 1");

            // apply the same transfer again and verify that it is allowed
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber + 1),
                new BigNumber(71),
                [new BigNumber(0)],
                [alice.pkh]);
            signature = await bobSk.sign(toHexString(msgToSign));
            tandemClaim = {
                helpers: [alice.pkh],
                activities: [0],
                minutes: 71,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }]},
            };
            await instance.register_tandem_claims([tandemClaim]);
            var aliceAfterAfter = await storage.ledger.get(alice.pkh);
            var bobAfterAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfterAfter.balance.isEqualTo(new BigNumber(202)), "Alice's new balance is 202");
            assert(bobAfterAfter.balance.isEqualTo(new BigNumber(0)), "Bob's new balance is 0");
            assert(bobAfterAfter.debit.isEqualTo(new BigNumber(72)), "Bob's new debit is 72");

            // Switch helpee and helper roles and verify that balances and debits are updated correctly
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [bob.pkh]);
            signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };
            await instance.register_tandem_claims([tandemClaim]);
            aliceAfterAfter = await storage.ledger.get(alice.pkh);
            bobAfterAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfterAfter.balance.isEqualTo(new BigNumber(201)), "Alice's new balance is 201");
            assert(bobAfterAfter.balance.isEqualTo(new BigNumber(0)), "Bob's new balance is 0");
            assert(bobAfterAfter.debit.isEqualTo(new BigNumber(71)), "Bob's new debit is 71");

            // Apply a similar tandem again and verify that balances and debit are updated correctly
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber + 1),
                new BigNumber(2),
                [new BigNumber(0)],
                [bob.pkh]);
            signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 2,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };
            await instance.register_tandem_claims([tandemClaim]);
            aliceAfterAfter = await storage.ledger.get(alice.pkh);
            bobAfterAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfterAfter.balance.isEqualTo(new BigNumber(199)), "Alice's new balance is 199");
            assert(bobAfterAfter.balance.isEqualTo(new BigNumber(0)), "Bob's new balance is 0");
            assert(bobAfterAfter.debit.isEqualTo(new BigNumber(69)), "Bob's new debit is 69");

            // Return Bob to his original balance by first removing debit and adding to balance
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber + 2),
                new BigNumber(139),
                [new BigNumber(0)],
                [bob.pkh]);
            signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 139,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };
            await instance.register_tandem_claims([tandemClaim]);
            aliceAfterAfter = await storage.ledger.get(alice.pkh);
            bobAfterAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfterAfter.balance.isEqualTo(new BigNumber(60)), "Alice's final balance is 60");
            assert(bobAfterAfter.balance.isEqualTo(new BigNumber(70)), "Bob's final balance is 70");
            assert(bobAfterAfter.debit.isEqualTo(new BigNumber(0)), "Bob's final debit is 0");
        });

        it('should fail on wrong signature with bad secret key', async () => {
            // Sign with Alice's key but let helpee be Bob
            let aliceSk = new InMemorySigner(alice.sk);
            let bobNonce = await storage.nonces.get(bob.pkh) || new BigNumber(0);
            let bobNonceNumber = bobNonce.toNumber();

            // Express amount in mutez
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [charlie.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Change signer and verify that it works
            let bobSK = new InMemorySigner(bob.sk);
            signature = await bobSK.sign(toHexString(msgToSign));
            tandemClaim.helpees.signed_helpee[0].signature = signature.sig;
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('should fail on wrong signature with bad minute value', async () => {
            let bobSk = new InMemorySigner(bob.sk);
            let bobNonce = await storage.nonces.get(bob.pkh) || new BigNumber(0);
            let bobNonceNumber = bobNonce.toNumber();

            // Sign for one minute but request two minutes
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await bobSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [charlie.pkh],
                activities: [0],
                minutes: 2,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Sign for two minutes and verify that it works
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(2),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await bobSk.sign(toHexString(msgToSign));
            tandemClaim.helpees.signed_helpee[0].signature = signature.sig;
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('should fail on wrong signature with bad nonce', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();

            // Express amount in mutez
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber - 1),
                new BigNumber(1),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [charlie.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Fix nonce and verify that it works
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim.helpees.signed_helpee[0].signature = signature.sig;
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('should fail on wrong signature with recipient address', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();

            // Express amount in mutez
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [charlie.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Fix recipient and verify that it works
            tandemClaim.helpers[0] = charlie.pkh;
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('should fail on wrong signature with address/public key mismatch', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh) || new BigNumber(0);
            let aliceNonceNumber = aliceNonce.toNumber();

            // Express amount in mutez
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [bob.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));

            // In this tandem claim, the signature is valid for the provided message
            // and public key, but the helpee address does not match the public key
            // This claim must be rejected
            var tandemClaim = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Fix helpee address and verify that it works
            tandemClaim.helpees.signed_helpee[0].address = alice.pkh;
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('disallow unregistered activities', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh) || new BigNumber(0);
            let aliceNonceNumber = aliceNonce.toNumber();

            // Express amount in mutez
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(3)],
                [bob.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [bob.pkh],
                activities: [3],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "UNKNOWN_ACTIVITY"
            );

            // Change activity and verify that it works
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(2)],
                [bob.pkh]);
            signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim.activities[0] = 2;
            tandemClaim.helpees.signed_helpee[0].signature = signature.sig;
            await instance.register_tandem_claims([tandemClaim]);

            // Disallow activity 2 and verify expected error message
            await instance.call_suspend_allowed_activity(2);

            aliceNonce = await storage.nonces.get(alice.pkh);
            aliceNonceNumber = aliceNonce.toNumber();
            msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(1),
                [new BigNumber(2)],
                [bob.pkh]);
            signature = await aliceSk.sign(toHexString(msgToSign));
            tandemClaim.helpees.signed_helpee[0].signature = signature.sig;

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "ACTIVITY_SUSPENDED"
            );

            // Allow activity 2 again, and verify that this registration is now allowed
            await instance.call_add_allowed_activity(2);
            await instance.register_tandem_claims([tandemClaim]);
        });

        it('should allow two helpers on one claim', async () => {
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();
            let aliceSk = new InMemorySigner(alice.sk);
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(2),
                [new BigNumber(0)],
                [bob.pkh, david.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [bob.pkh, david.pkh],
                activities: [0],
                minutes: 2,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            // const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.minus(new BigNumber(2))), "Alice's has two minutes less");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(1))), "Bob has one more minute");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.plus(new BigNumber(1))), "David has one more minute");
            // assert(charlieAfter.balance.isEqualTo(new BigNumber(1)), "Charlie has one minute");
        });

        it('should allow three helpers on one claim', async () => {
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();
            let aliceSk = new InMemorySigner(alice.sk);
            var msgToSign = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber),
                new BigNumber(3),
                [new BigNumber(0)],
                [bob.pkh, charlie.pkh, david.pkh]);
            var signature = await aliceSk.sign(toHexString(msgToSign));
            var tandemClaim = {
                helpers: [bob.pkh, charlie.pkh, david.pkh],
                activities: [0],
                minutes: 3,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }]},
            };

            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.minus(new BigNumber(3))), "Alice's has three minutes less");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(1))), "Bob has one more minute");
            assert(charlieAfter.balance.isEqualTo(charlieBefore.balance.plus(new BigNumber(1))), "Charlie has one more minute");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.plus(new BigNumber(1))), "David has one more minute");
        });

        it('should handle multiple tandem claims', async () => {
            let aliceSk = new InMemorySigner(alice.sk);
            let bobSk = new InMemorySigner(bob.sk);
            let aliceNonce = await storage.nonces.get(alice.pkh);
            let aliceNonceNumber = aliceNonce.toNumber();
            let bobNonce = await storage.nonces.get(bob.pkh) || new BigNumber(0);
            let bobNonceNumber = bobNonce.toNumber();

            var msgToSign0 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber++),
                new BigNumber(1),
                [new BigNumber(0)],
                [bob.pkh]);
            var msgToSign1 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber++),
                new BigNumber(2),
                [new BigNumber(0)],
                [charlie.pkh]);
            var msgToSign2 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber++),
                new BigNumber(3),
                [new BigNumber(1)],
                [david.pkh]);
            var msgToSign3 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(aliceNonceNumber++),
                new BigNumber(4),
                 // The order of activities in this list should not matter as they are sorted before made into a hash preimage
                 // this reflects that they are handled as a set in the LIGO smart contract
                [new BigNumber(2), new BigNumber(1)],
                [bob.pkh]);
            var msgToSign4 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(1),
                [new BigNumber(0)],
                [alice.pkh]);
            var signature0 = await aliceSk.sign(toHexString(msgToSign0));
            var signature1 = await aliceSk.sign(toHexString(msgToSign1));
            var signature2 = await aliceSk.sign(toHexString(msgToSign2));
            var signature3 = await aliceSk.sign(toHexString(msgToSign3));
            var signature4 = await bobSk.sign(toHexString(msgToSign4));
            var tandemClaim0 = {
                helpers: [bob.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature0.sig,
                }]},
            };
            var tandemClaim1 = {
                helpers: [charlie.pkh],
                activities: [0],
                minutes: 2,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature1.sig,
                }]},
            };
            var tandemClaim2 = {
                helpers: [david.pkh],
                activities: [1],
                minutes: 3,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature2.sig,
                }]},
            };
            var tandemClaim3 = {
                helpers: [bob.pkh],
                activities: [1, 2],
                minutes: 4,
                helpees: { signed_helpee: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature3.sig,
                }]},
            };
            var tandemClaim4 = {
                helpers: [alice.pkh],
                activities: [0],
                minutes: 1,
                helpees: { signed_helpee: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature4.sig,
                }]},
            };

            // Charlie does not have an initial entry in storage, so we cannot
            // look up charlie prior to the function call
            activity_storage = await activity_instance.storage();
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            const activity0Before = activity_storage.activity_balance.get('0');
            const activity1Before = activity_storage.activity_balance.get('1');
            const activity2Before = activity_storage.activity_balance.get('2');
            await instance.register_tandem_claims([tandemClaim0, tandemClaim1, tandemClaim2, tandemClaim3, tandemClaim4]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.minus(new BigNumber(9))), "Alice's has nine minutes less");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(4))), "Bob has four more minutes");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.plus(new BigNumber(3))), "David has three more minutes");
            assert(charlieAfter.balance.isEqualTo(charlieBefore.balance.plus(new BigNumber(2))), "Charlie has two more minutes");

            // Verify new activity log values
            activity_storage = await activity_instance.storage();
            const activity0After = activity_storage.activity_balance.get('0');
            const activity1After = activity_storage.activity_balance.get('1');
            const activity2After = activity_storage.activity_balance.get('2');
            assert(activity0After.isEqualTo(activity0Before.plus(new BigNumber(4))), "Time spent on activity 0 increased by 4");
            assert(activity1After.isEqualTo(activity1Before.plus(new BigNumber(5))), "Time spent on activity 1 increased by 5");
            assert(activity2After.isEqualTo(activity2Before.plus(new BigNumber(2))), "Time spent on activity 2 increased by 2");
        });

        // Below here, you can place tests that mess-up the storage of the deployed contracts, e.g. remove alice as admin
        // as they are run last and shouldn't sabotage the other tests
        it('should be possible to change activity log admin', async () => {
            activity_storage = await activity_instance.storage();
            assert.equal(activity_storage.admin, instance.address);
            await instance.call_change_admin(bob.pkh);
            activity_storage = await activity_instance.storage();
            assert.equal(activity_storage.admin, bob.pkh);
        });

        it('should be possible to change activity address', async () => {
            const new_activity_log = 'KT1X6Mao155GRSGRHJsXyJ9D97s22x25osCu';
            storage = await instance.storage();
            assert.equal(storage.external_contract_address, activity_instance.address);
            await instance.change_activity_log(new_activity_log);
            storage = await instance.storage();
            assert.equal(storage.external_contract_address, new_activity_log);
        });

        it('Should be possible to change admin and only admin can call admin endpoints', async () => {
            storage = await instance.storage();
            assert.equal(storage.admin, alice.pkh);
            await instance.change_admin_this(bob.pkh);
            storage = await instance.storage();
            assert.equal(storage.admin, bob.pkh);

            await expectThrow(
                instance.call_add_allowed_activity(1),
                "CALLER_NOT_ADMIN"
            );
            await expectThrow(
                instance.call_suspend_allowed_activity(3),
                "CALLER_NOT_ADMIN"
            );
            await expectThrow(
                instance.call_change_admin(charlie.pkh),
                "CALLER_NOT_ADMIN"
            );
            await expectThrow(
                instance.change_activity_log(charlie.pkh),
                "CALLER_NOT_ADMIN"
            );
            await expectThrow(
                instance.change_admin_this(charlie.pkh),
                "CALLER_NOT_ADMIN"
            );
        });
    });
});
