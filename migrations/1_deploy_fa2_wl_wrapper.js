const fa2_wl_wrapper = artifacts.require('fa2_wl_wrapper');
const initial_storage = require('./../helpers/storage');
const saveContractAddress = require('./../helpers/saveContractAddress');

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa2_wl_wrapper, initial_storage.initial_storage_fa2_wl_wrapper)
        .then((contract) => {
            saveContractAddress('tzip12', contract.address);
        })
        .catch((err) => {
            console.log(err);
        });
};
