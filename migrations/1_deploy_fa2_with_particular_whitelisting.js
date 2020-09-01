const fa2_wl = artifacts.require('fa2_with_particular_whitelisting');
const { alice, bob, charlie, david } = require('../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('../helpers/saveContractAddress');
const storage = require('../helpers/storage');

// Set initial storage which is a parameter to the deployment
// operation

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa2_wl, storage.initial_storage_fa2_pwl)
        .then((contract) => saveContractAddress('tzip12', contract.address));
};
