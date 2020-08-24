function addWhitelisters(addresses) {
    return args(addresses, 'add_whitelister');
}

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

function removeWhitelisters(addresses) {
    return args(addresses, 'remove_whitelister');
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

function args(addresses, field) {
    return addresses.map(function (x) {
        return { [field]: x.pkh };
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

async function expectThrow(promise, message) {
    try {
        await promise;
    } catch (error) {
        if (message !== undefined) {
            assert(
                error.message === message,
                `Expected '${message}' to equal '${error.message}'`
            );
        }
        return;
    }
    assert.fail('Expected throw not received');
}

module.exports = {
    addWhitelisters,
    addWhitelisteds,
    removeWhitelisters,
    removeWhitelisteds,
    transferParams,
    expectThrow,
};
