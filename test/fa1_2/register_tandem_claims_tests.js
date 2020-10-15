const BigNumber = require('bignumber.js');
const { InMemorySigner } = require('@taquito/signer');
const fa1_2_kiss = artifacts.require("fa1_2_kiss");
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

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 KISS contract deployed at:', instance.address);
        storage = await instance.storage();
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

            // Express amount in mutez
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }],
            };

            // Also express amount in mutez here
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            assert(aliceBefore.balance.isEqualTo(new BigNumber(120)), "Alice's intial balance is 120");
            assert(bobBefore.balance.isEqualTo(new BigNumber(10)), "Bob's intial balance is 10");
            await instance.register_tandem_claims([tandemClaim]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            assert(aliceAfter.balance.isEqualTo(new BigNumber(60)), "Alice's new balance is 60");
            assert(bobAfter.balance.isEqualTo(new BigNumber(70)), "Bob's new balance is 70");
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
                helpees: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }],
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Change signer and verify that it works
            let bobSK = new InMemorySigner(bob.sk);
            signature = await bobSK.sign(toHexString(msgToSign));
            tandemClaim.helpees[0].signature = signature.sig;
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
                helpees: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature.sig,
                }],
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
            tandemClaim.helpees[0].signature = signature.sig;
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }],
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
            tandemClaim.helpees[0].signature = signature.sig;
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }],
            };

            await expectThrow(
                instance.register_tandem_claims([tandemClaim]),
                "INVALID_SIGNATURE"
            );

            // Fix recipient and verify that it works
            tandemClaim.helpers[0] = charlie.pkh;
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }],
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature.sig,
                }],
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
                [new BigNumber(2)],
                [bob.pkh]);
            var msgToSign4 = packFourTupleAsLeftBalancedPairs(
                new BigNumber(bobNonceNumber),
                new BigNumber(1),
                [new BigNumber(3)],
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
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature0.sig,
                }],
            };
            var tandemClaim1 = {
                helpers: [charlie.pkh],
                activities: [0],
                minutes: 2,
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature1.sig,
                }],
            };
            var tandemClaim2 = {
                helpers: [david.pkh],
                activities: [1],
                minutes: 3,
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature2.sig,
                }],
            };
            var tandemClaim3 = {
                helpers: [bob.pkh],
                activities: [2],
                minutes: 4,
                helpees: [{
                    address: alice.pkh,
                    pk: alice.pk,
                    signature: signature3.sig,
                }],
            };
            var tandemClaim4 = {
                helpers: [alice.pkh],
                activities: [3],
                minutes: 1,
                helpees: [{
                    address: bob.pkh,
                    pk: bob.pk,
                    signature: signature4.sig,
                }],
            };

            // Charlie does not have an initial entry in storage, so we cannot
            // look up charlie prior to the function call
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            const charlieBefore = await storage.ledger.get(charlie.pkh);
            const davidBefore = await storage.ledger.get(david.pkh);
            await instance.register_tandem_claims([tandemClaim0, tandemClaim1, tandemClaim2, tandemClaim3, tandemClaim4]);
            const aliceAfter = await storage.ledger.get(alice.pkh);
            const bobAfter = await storage.ledger.get(bob.pkh);
            const charlieAfter = await storage.ledger.get(charlie.pkh);
            const davidAfter = await storage.ledger.get(david.pkh);
            assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.minus(new BigNumber(9))), "Alice's has nine minutes less");
            assert(bobAfter.balance.isEqualTo(bobBefore.balance.plus(new BigNumber(4))), "Bob has four more minutes");
            assert(davidAfter.balance.isEqualTo(davidBefore.balance.plus(new BigNumber(3))), "David has three more minutes");
            assert(charlieAfter.balance.isEqualTo(charlieBefore.balance.plus(new BigNumber(2))), "Charlie has two more minutes");
        });
    });
});
