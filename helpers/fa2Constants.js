module.exports = {
    unit: undefined,
    rpcErrors: {
        michelson: {
            scriptRejected: 'proto.005-PsBabyM1.michelson_v1.script_rejected',
            runtimeError: 'proto.005-PsBabyM1.michelson_v1.runtime_error',
        },
    },
    contractErrors: {
        notOperator: 'FA2_NOT_OPERATOR',
        insufficientBalance: 'FA2_INSUFFICIENT_BALANCE',
        unknownTokenId: 'FA2_TOKEN_UNDEFINED',
        approveOnBehalfOfOthers: 'Only owner can update operators',
        notNrWlAdmin: 'NOT_NON_REVOCABLE_WHITELIST_ADMIN',
        newNrWlAdminNotWlAdmin:
            'NEW_NON_REVOCABLE_WHITELIST_ADMIN_NOT_WHITELIST_ADMIN',
        callerIsNonRevocableWlAdmin:
            'CALLER_IS_NON_REVOCABLE_WHITELIST_ADMIN',
        onlyWlrCanAddWld: 'ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS',
        senderNotWhitelisted: 'SENDER_NOT_WHITELISTED',
        receiverNotWhitelisted: 'RECEIVER_NOT_WHITELISTED',
    },
};
