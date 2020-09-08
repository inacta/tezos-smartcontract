const BigNumber = require('bignumber.js');
const fa1_2_burn_mint = artifacts.require("fa1_2_burn_mint");
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
    let fa1_2_instances_bob_minter;
    let bob_minter_storage;

    before(async () => {
        contract_names[0] = "fa1_2_burn_mint, Alice is minter";
        fa1_2_instances[0] = await fa1_2_burn_mint.new(initial_storage.initial_storage_fa1_2_burn_mint_alice_minter);
        console.log('FA1.2 burn/mint:', fa1_2_instances[0].address);
        storages[0] = await fa1_2_instances[0].storage();

        fa1_2_instances_bob_minter = await fa1_2_burn_mint.new(initial_storage.initial_storage_fa1_2_burn_mint_bob_minter);
        bob_minter_storage = await fa1_2_instances_bob_minter.storage();
        console.log('FA1.2 burn/mint, Bob minter:', fa1_2_instances_bob_minter.address);
    });

    describe('mint', () => {
        it('minter should be able mint to anyone', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                var storage = storages[i];
                const aliceBefore = await storage.ledger.get(alice.pkh);
                const bobBefore = await storage.ledger.get(bob.pkh);
                const charlieBefore = await storage.ledger.get(charlie.pkh);
                const davidBefore = await storage.ledger.get(david.pkh);
                const total_supply_start = storage.total_supply;

                // Mint 3 to self
                const mintAmountAlice = new BigNumber(3);
                await instance.mint(alice.pkh, mintAmountAlice);
                var aliceAfter = await storage.ledger.get(alice.pkh);
                var bobAfter = await storage.ledger.get(bob.pkh);
                var charlieAfter = await storage.ledger.get(charlie.pkh);
                var davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.plus(mintAmountAlice).isEqualTo(aliceAfter.balance), "Alice's balance must be increased with 2, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance is unchanged by Alice's mint to self, " + name );
                assert(davidBefore.balance.isEqualTo(davidAfter.balance), "David's balance is unchanged by Alice's mint to self, " + name );

                // Verify that total supply is updated
                storage = await instance.storage();
                assert(storage.total_supply.isEqualTo(total_supply_start.plus(3)), "Total supply must be updated after successful mint");

                // Mint 4 to David
                await instance.mint(david.pkh, 4);
                aliceAfter = await storage.ledger.get(alice.pkh);
                bobAfter = await storage.ledger.get(bob.pkh);
                charlieAfter = await storage.ledger.get(charlie.pkh);
                davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.plus(mintAmountAlice).isEqualTo(aliceAfter.balance), "Alice's must be unchanged by her mint to David, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance is unchanged by Alice's mint to David, " + name );
                assert(davidBefore.balance.plus(new BigNumber(4)).isEqualTo(davidAfter.balance), "David's balance is increased by 4 by Alice's mint, " + name );

                // Mint to non-existing address and verify that one is created
                await instance.mint(charlie.pkh, 4);
                aliceAfter = await storage.ledger.get(alice.pkh);
                bobAfter = await storage.ledger.get(bob.pkh);
                charlieAfter = await storage.ledger.get(charlie.pkh);
                davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.plus(mintAmountAlice).isEqualTo(aliceAfter.balance), "Alice's must be unchanged by her mint to Charlie, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance is unchanged by mint to Charlie, " + name );
                assert(charlieAfter.balance.isEqualTo(new BigNumber(4)), "Charlie now has an account with a positive balance, " + name );
                assert(davidBefore.balance.plus(new BigNumber(4)).isEqualTo(davidAfter.balance), "David's balance is increased by mint to Charlie, " + name );

                // Ensure that minting of 0 is allowed
                await instance.mint(david.pkh, 0);
                aliceAfter = await storage.ledger.get(alice.pkh);
                bobAfter = await storage.ledger.get(bob.pkh);
                charlieAfter = await storage.ledger.get(charlie.pkh);
                davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.plus(mintAmountAlice).isEqualTo(aliceAfter.balance), "Alice's balance must be unchanged by zero-mint, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unchanged by zero-mint, " + name );
                assert(charlieAfter.balance.isEqualTo(new BigNumber(4)), "Charlie's balance must be unchanged by zero-mint, " + name );
                assert(davidBefore.balance.plus(new BigNumber(4)).isEqualTo(davidAfter.balance), "David's balance must be unchanged by zero-mint, " + name );
            }
        });

        it('Only minter can mint', async () => {
            const aliceBefore = await bob_minter_storage.ledger.get(alice.pkh);
            const bobBefore = await bob_minter_storage.ledger.get(bob.pkh);
            await expectThrow(
                fa1_2_instances_bob_minter.mint(bob.pkh, 4),
                constants.contractErrors.onlyMinterCanMint
            );
            var aliceAfter = await bob_minter_storage.ledger.get(alice.pkh);
            var bobAfter = await bob_minter_storage.ledger.get(bob.pkh);

            assert(aliceBefore.balance.isEqualTo(aliceAfter.balance), "Alice's balance must be unchanged by failed minting");
            assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unchanged by failed minting");

            await expectThrow(
                fa1_2_instances_bob_minter.mint(alice.pkh, 4),
                constants.contractErrors.onlyMinterCanMint
            );
            aliceAfter = await bob_minter_storage.ledger.get(alice.pkh);
            bobAfter = await bob_minter_storage.ledger.get(bob.pkh);

            assert(aliceBefore.balance.isEqualTo(aliceAfter.balance), "Alice's balance must be unchanged by failed minting 2");
            assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unchanged by failed minting 2");
        })
    });

    describe('burn', () => {
        it('Can burn from own account', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                var storage = await instance.storage();
                const aliceBefore = await storage.ledger.get(alice.pkh);
                const bobBefore = await storage.ledger.get(bob.pkh);
                const charlieBefore = await storage.ledger.get(charlie.pkh);
                const davidBefore = await storage.ledger.get(david.pkh);
                const total_supply_start = storage.total_supply;

                // Burn 2 from self
                await instance.burn(2);
                var aliceAfter = await storage.ledger.get(alice.pkh);
                var bobAfter = await storage.ledger.get(bob.pkh);
                var charlieAfter = await storage.ledger.get(charlie.pkh);
                var davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.minus(new BigNumber(2)).isEqualTo(aliceAfter.balance), "Alice's balance must be decreased by 2, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance is unchanged by Alice's burn, " + name );
                assert(davidBefore.balance.isEqualTo(davidAfter.balance), "David's balance is unchanged by Alice's burn, " + name );

                // Verify that total supply is updated
                storage = await instance.storage();
                assert(storage.total_supply.isEqualTo(total_supply_start.minus(2)), "Total supply must be updated after successful burn");

                // Ensure that burning of 0 is allowed
                await instance.burn(0);
                aliceAfter = await storage.ledger.get(alice.pkh);
                bobAfter = await storage.ledger.get(bob.pkh);
                charlieAfter = await storage.ledger.get(charlie.pkh);
                davidAfter = await storage.ledger.get(david.pkh);
                assert(aliceBefore.balance.minus(new BigNumber(2)).isEqualTo(aliceAfter.balance), "Alice's balance must be unchanged by zero-mint, " + name );
                assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unchanged by zero-mint, " + name );
                assert(charlieAfter.balance.isEqualTo(new BigNumber(4)), "Charlie's balance must be unchanged by zero-mint, " + name );
                assert(davidBefore.balance.isEqualTo(davidAfter.balance), "David's balance must be unchanged by zero-mint, " + name );
                await instance.burn(9);
                aliceAfter = await storage.ledger.get(alice.pkh);

                // Disallow burning of more than own balance
                await expectThrow(
                    instance.burn(aliceAfter.balance.plus(1).toNumber()),
                    constants.contractErrors.insufficientBalance
                );
                aliceAfter = await storage.ledger.get(alice.pkh);

                // Allow burning entire balance
                await instance.burn(aliceAfter.balance.toNumber());
                aliceAfter = await storage.ledger.get(alice.pkh);
                assert(aliceAfter.balance.isEqualTo(new BigNumber(0)), "Alice's balance is zero after total burn, " + name );
            }
        });

        // Bob is minter but Alice is burning
        it('Anyone can burn', async () => {
            const aliceBefore = await bob_minter_storage.ledger.get(alice.pkh);
            const bobBefore = await bob_minter_storage.ledger.get(bob.pkh);
            await fa1_2_instances_bob_minter.burn(4);
            var aliceAfter = await bob_minter_storage.ledger.get(alice.pkh);
            var bobAfter = await bob_minter_storage.ledger.get(bob.pkh);

            assert(aliceBefore.balance.isEqualTo(aliceAfter.balance.plus(4)), "Alice's balance must be decreased by burning although she is not minter");
            assert(bobBefore.balance.isEqualTo(bobAfter.balance), "Bob's balance must be unaffected by Alice's burn");
        })
    })
});
