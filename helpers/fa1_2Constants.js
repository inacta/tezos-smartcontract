module.exports = {
    unit: undefined,
    rpcErrors: {
        michelson: {
            scriptRejected: 'proto.005-PsBabyM1.michelson_v1.script_rejected',
            runtimeError: 'proto.005-PsBabyM1.michelson_v1.runtime_error',
        },
    },
    contractErrors: {
        insufficientBalance: 'NotEnoughBalance',
        insufficientAllowance: 'NotEnoughAllowance',
        unsafeAllowanceChange: 'UnsafeAllowanceChange',
        senderNotWhiteListed: 'SENDER_NOT_WHITELISTED',
        receiverNotWhiteListed: 'RECEIVER_NOT_WHITELISTED',
        onlyWlrCanAddWld: 'ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS',
        onlyMinterCanMint: 'ONLY_MINTER_CAN_MINT'
    },
};
