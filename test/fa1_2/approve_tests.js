const BigNumber = require('bignumber.js');
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

    describe('approve', () => {
        it('should be able to approve other to operate own account', async () => {
            const aliceBefore = await storage.ledger.get(alice.pkh);
            const bobBefore = await storage.ledger.get(bob.pkh);
            await fa1_2_basic_instance.approve(bob.pkh, 1);
            var aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(1)), "After successful call to approve, allowance must be 1");

            // Set allowance back to 0, and set it to another number
            await fa1_2_basic_instance.approve(bob.pkh, 0);
            await fa1_2_basic_instance.approve(bob.pkh, 6);
            aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(6)), "After successful call to approve, allowance must be 6");

            // Disallow allowance to be set to a strictly positive number when it is already a strictly positive number
            await expectThrow(
                fa1_2_basic_instance.approve(bob.pkh, 1),
                constants.contractErrors.unsafeAllowanceChange
            );
            aliceAfter = await storage.ledger.get(alice.pkh);
            assert(aliceAfter.allowances.get(bob.pkh).isEqualTo(new BigNumber(6)), "After failed call to approve, allowance must be unchanged");
        });
    });
});
