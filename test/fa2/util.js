function addWhitelisteds(accounts, token_id = 0) {
    return accounts.map(account => {
        return {
            add_whitelisted: {
                token_id,
                address: account.pkh,
            }
        }
    });
}

function removeWhitelisteds(accounts, token_id = 0) {
    return accounts.map(account => {
        return {
            remove_whitelisted: {
                token_id,
                address: account.pkh,
            }
        }
    });
}

function transferParams(transfers, token_id = 0) {
    return transfers.map((fromTransfers) => ({
        from_: fromTransfers.from.pkh,
        txs: fromTransfers.to.map((tuple) => ({
            token_id,
            to_: tuple[0].pkh,
            amount: tuple[1],
        })),
    }));
}

module.exports = {
    addWhitelisteds,
    removeWhitelisteds,
    transferParams,
};
