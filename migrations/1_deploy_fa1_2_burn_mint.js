const fa1_2_burn_mint = artifacts.require('fa1_2_burn_mint');
const saveContractAddress = require('../helpers/saveContractAddress');
const storage = require('./../helpers/storage');

module.exports = async (deployer, network, accounts) => {
    // TODO format to await instead of .then
    deployer
        .deploy(fa1_2_burn_mint, storage.initial_storage_fa1_2_burn_mint_alice_minter)
        .then((contract) => saveContractAddress('tzip7', contract.address));
};
