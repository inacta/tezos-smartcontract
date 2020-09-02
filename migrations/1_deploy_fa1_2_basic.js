const fa1_2_basic = artifacts.require('fa1_2_basic');
const saveContractAddress = require('../helpers/saveContractAddress');
const storage = require('./../helpers/storage');

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa1_2_basic, storage.initial_storage_fa1_2_basic)
        .then((contract) => saveContractAddress('tzip7', contract.address));
};
