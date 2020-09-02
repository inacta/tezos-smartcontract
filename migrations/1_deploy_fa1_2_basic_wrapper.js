const fa1_2_basic_wrapper = artifacts.require('fa1_2_basic_wrapper');
const storage = require('./../helpers/storage');
const saveContractAddress = require('./../helpers/saveContractAddress');

const initial_storage = {
    allowance_response: 0n,
    balance_response: 0n,
    total_supply_response: 0n,
};

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa1_2_basic_wrapper, storage.initial_storage_fa1_2_wrapper)
        .then((contract) => {
            saveContractAddress('tzip7', contract.address);
        })
        .catch((err) => {
            console.log(err);
        });
};
