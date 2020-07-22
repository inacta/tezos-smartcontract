const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');
const { alice, bob, charlie, david } = require('./../scripts/sandbox/accounts');
const { MichelsonMap } = require('@taquito/taquito');
const saveContractAddress = require('./../helpers/saveContractAddress');

// Set initial storage which is a parameter to the deployment
// operation
const initial_storage = bob.pkh;

module.exports = async (deployer, network, accounts) => {

    // TODO format to await instead of .then
    deployer.deploy(fa2_wl_wrapper, initial_storage)
        .then(contract => saveContractAddress('tzip12', contract.address));

};
module.exports.initial_storage = initial_storage;
