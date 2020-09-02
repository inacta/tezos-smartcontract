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

module.exports = {
    expectThrow,
};
