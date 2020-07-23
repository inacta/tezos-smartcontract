function addWhitelisters(new_whitelister_addresses) {
    return new_whitelister_addresses.map(function (x) { return { 'add_whitelister': x.pkh } });
}

function addWhitelisteds(new_whitelisted_addresses) {
    return new_whitelisted_addresses.map(function (x) { return { 'add_whitelisted': x.pkh } });
}

function removeWhitelisters(whitelister_addresses) {
    return whitelister_addresses.map(function (x) { return { 'remove_whitelister': x.pkh } });
}

function removeWhitelisteds(whitelisted_addresses) {
    return whitelisted_addresses.map(function (x) { return { 'remove_whitelisted': x.pkh } });
}

async function expectThrow (promise, message) {
    try {
        await promise
    } catch (error) {
        if (message !== undefined) {
            assert(error.message === message, `Expected '${message}' to equal '${error.message}'`)
        }
        return
    }
    assert.fail('Expected throw not received')
}

module.exports = {
    addWhitelisters,
    addWhitelisteds,
    removeWhitelisters,
    removeWhitelisteds,
    expectThrow,
}