function addWhitelisters(addresses) {
    return args(addresses, 'add_whitelister');
}

function addWhitelisteds(addresses) {
    return args(addresses, 'add_whitelisted');
}

function removeWhitelisters(addresses) {
    return args(addresses, 'remove_whitelister');
}

function removeWhitelisteds(addresses) {
    return args(addresses, 'remove_whitelisted');
}

function args(addresses, field) {
    return addresses.map(function (x) {
        return { [field]: x.pkh };
    });
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
    expectThrow,
};
