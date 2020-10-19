const BigNumber = require('bignumber.js');
const fa1_2_basic = artifacts.require("fa1_2_basic");
const fa1_2_burn_mint = artifacts.require("fa1_2_burn_mint");
const fa1_2_with_whitelisting = artifacts.require("fa1_2_with_whitelisting");
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

    describe('approve', () => {
        it('should be able to approve other to operate own account', async () => {
            for (let i = 0; i < contract_names.length; i++) {
                const instance = fa1_2_instances[i];
                const name = contract_names[i];
                const storage = storages[i];
                const aliceBefore = await storage.ledger.get(alice.pkh);
                const bobBefore = await storage.ledger.get(bob.pkh);
                await instance.approve(bob.pkh, 1);
                var aliceAfter = await storage.ledger.get(alice.pkh);
                assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(1)), "After successful call to approve, allowance must be 1, " + name);

                // Set allowance back to 0, and set it to another number
                await instance.approve(bob.pkh, 0);
                await instance.approve(bob.pkh, 6);
                aliceAfter = await storage.ledger.get(alice.pkh);
                assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(6)), "After successful call to approve, allowance must be 6, " + name);

                // Disallow allowance to be set to a strictly positive number when it is already a strictly positive number
                await expectThrow(
                    instance.approve(bob.pkh, 1),
                    constants.contractErrors.unsafeAllowanceChange
                );
                aliceAfter = await storage.ledger.get(alice.pkh);
                assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(6)), "After failed call to approve, allowance must be unchanged, " + name);

                // Set allowance back to 0 to prevent this from disturbing state
                await instance.approve(bob.pkh, 0);
            }
        });
    });
});
