function addWhitelistedsSingular(accounts) {
    return accounts.map(account => {
        return {
            add_whitelisted: account.pkh
        }
    });
}

function addWhitelisters(addresses) {
    return args(addresses, 'add_whitelister');
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
    assert.fail(`Expected throw not received for test: "${message}"`);
}

function removeWhitelistedsSingular(accounts) {
    return accounts.map(account => {
        return {
            remove_whitelisted: account.pkh
        }
    });
}

function removeWhitelisters(addresses) {
    return args(addresses, 'remove_whitelister');
}

function args(addresses, field) {
    return addresses.map(function (x) {
        return { [field]: x.pkh };
    });
}

module.exports = {
    addWhitelistedsSingular,
    addWhitelisters,
    expectThrow,
    removeWhitelistedsSingular,
    removeWhitelisters
};
