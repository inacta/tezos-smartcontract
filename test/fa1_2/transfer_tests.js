const BigNumber = require('bignumber.js');
const fa1_2_basic = artifacts.require("fa1_2_basic");
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
const fa1_2_burn_mint = artifacts.require("fa1_2_burn_mint");
const fa1_2_kiss = artifacts.require("fa1_2_kiss");
const initial_storage = require('../../helpers/storage');

const { alice, bob, charlie, david } = require('../../scripts/sandbox/accounts');

const constants = require('../../helpers/fa1_2Constants.js');

const {
    expectThrow,
} = require('../shared_utils.js');

contract('fa1_2_basic and fa1_2_with_whitelisting', (_accounts) => {
    let storages = [];
    let fa1_2_instances = [];
    let contract_names = [];

    before(async () => {
        contract_names[0] = "fa1_2_basic";
        fa1_2_instances[0] = await fa1_2_basic.new(initial_storage.initial_storage_fa1_2_basic);
        contract_names[1] = "fa1_2_with_whitelisting all whitelisted";
        fa1_2_instances[1] = await fa1_2_with_whitelisting.new(initial_storage.initial_storage_fa1_2_with_whitelisting_all_whitelisted);
        contract_names[2] = "fa1_2_burn_mint";
        fa1_2_instances[2] = await fa1_2_burn_mint.new(initial_storage.initial_storage_fa1_2_burn_mint_alice_minter);
        contract_names[3] = "fa1_2_kiss";
        fa1_2_instances[3] = await fa1_2_kiss.new(initial_storage.initial_storage_fa1_2_kiss);

        /**
         * Display the current contract address for debugging purposes
         */
        console.log('FA1.2 contract deployed at:', fa1_2_instances[0].address);
        console.log('FA1.2-WL contract deployed at:', fa1_2_instances[1].address);
        console.log('FA1.2 burn/mint:', fa1_2_instances[2].address);
        console.log('FA1.2 kiss:', fa1_2_instances[3].address);
        storages[0] = await fa1_2_instances[0].storage();
        storages[1] = await fa1_2_instances[1].storage();
        storages[2] = await fa1_2_instances[2].storage();
        storages[3] = await fa1_2_instances[3].storage();
    });


        describe('transfer', () => {
            it('should be able to send from own address ', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa1_2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];
                    const aliceBefore = await storage.ledger.get(alice.pkh);
                    const bobBefore = await storage.ledger.get(bob.pkh);
                    const initial_balance = name === 'fa1_2_kiss' ? 120 : 10;
                    assert(aliceBefore.balance.isEqualTo(new BigNumber(initial_balance)), `Alice's intial balance is ${initial_balance}, ` + name);
                    assert(bobBefore.balance.isEqualTo(new BigNumber(10)), "Bob's intial balance is 10," + name);
                    await instance.transfer(alice.pkh, bob.pkh, 1);
                    var aliceAfter = await storage.ledger.get(alice.pkh);
                    var bobAfter = await storage.ledger.get(bob.pkh);
                    assert(aliceAfter.balance.isEqualTo((new BigNumber(initial_balance)).minus(1)), "Alice lost one, "  + name);
                    assert(bobAfter.balance.isEqualTo(new BigNumber(11)), "Bob gained one," + name);
                }
            });

            it('should be able to send to self', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa1_2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];
                    const aliceBefore = await storage.ledger.get(alice.pkh);
                    await instance.transfer(alice.pkh, alice.pkh, 1);
                    var aliceAfter = await storage.ledger.get(alice.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 1 to self, " + name);

                    // Sending two to self has same effect as sending 1
                    await instance.transfer(alice.pkh, alice.pkh, 2);
                    aliceAfter = await storage.ledger.get(alice.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 2 to self, " + name);

                    // Sending zero to self has same effect as sending 1
                    await instance.transfer(alice.pkh, alice.pkh, 0);
                    aliceAfter = await storage.ledger.get(alice.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Balance is unaffected when sending 0 to self, " + name);
                }
            });

            it('should not be able to send more than balance', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa1_2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];
                    const aliceBefore = await storage.ledger.get(alice.pkh);
                    const bobBefore = await storage.ledger.get(bob.pkh);
                    await expectThrow(
                        instance.transfer(alice.pkh, bob.pkh, aliceBefore.balance.toNumber() + 1),
                        constants.contractErrors.insufficientBalance
                    );
                    var aliceAfter = await storage.ledger.get(alice.pkh);
                    var bobAfter = await storage.ledger.get(bob.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Alice's balance must be unaffected by failed call to transfer, " + name);
                    assert(bobAfter.balance.isEqualTo(bobBefore.balance), "Bob's balance must be unaffected by failed call to transfer, " + name);
                }
            });

            it('transfer should handle allowances correctly', async () => {
                for (let i = 0; i < contract_names.length; i++) {
                    const instance = fa1_2_instances[i];
                    const name = contract_names[i];
                    const storage = storages[i];
                    const aliceBefore = await storage.ledger.get(alice.pkh);
                    const bobBefore = await storage.ledger.get(bob.pkh);
                    const davidBefore = await storage.ledger.get(david.pkh);

                    // Verify that operator cannot transfer when not approved
                    var trfsAmount = new BigNumber(1);
                    assert(davidBefore.balance.isGreaterThanOrEqualTo(trfsAmount), "David's balance must be greater than transfer amount, " + name);
                    await expectThrow(
                        instance.transfer(david.pkh, alice.pkh, trfsAmount),
                        constants.contractErrors.insufficientAllowance
                    );
                    var aliceAfter = await storage.ledger.get(alice.pkh);
                    var davidAfter = await storage.ledger.get(david.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance), "Alice's balance must be unaffected by failed call to transfer, " + name);
                    assert(davidAfter.balance.isEqualTo(davidAfter.balance), "David's balance must be unaffected by failed call to transfer, " + name);

                    // Verify that operator *can* transfer when approved
                    await instance.transfer(bob.pkh, alice.pkh, trfsAmount);
                    aliceAfter = await storage.ledger.get(alice.pkh);
                    var bobAfter = await storage.ledger.get(bob.pkh);
                    assert(aliceAfter.balance.isEqualTo(aliceBefore.balance.plus(trfsAmount)), "Alice's balance must be increased by 1, " + name);
                    assert(bobAfter.balance.isEqualTo(bobBefore.balance.minus(trfsAmount)), "Bob's balance must be decreased by 1, " + name);
                    assert(bobAfter.allowances.get(alice.pkh).isEqualTo(new BigNumber(7)));

                    // Verify that operator *cannot* transfer more than the approved amount
                    // 7 should be remaining in approved amount
                    trfsAmount = new BigNumber(8);
                    assert(bobAfter.balance.isGreaterThanOrEqualTo(trfsAmount), "Bob's balance must be at least transfer amount, " + name);
                    await expectThrow(
                        instance.transfer(bob.pkh, alice.pkh, trfsAmount),
                        constants.contractErrors.insufficientAllowance
                    );
                    const aliceAfterAfter = await storage.ledger.get(alice.pkh);
                    const bobAfterAfter = await storage.ledger.get(bob.pkh);
                    assert(aliceAfterAfter.balance.isEqualTo(aliceAfter.balance), "Alice's balance must be unchanged after failed transfer, " + name);
                    assert(bobAfterAfter.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unchanged after failed transfer, " + name  );
                }
            });
        });
});
