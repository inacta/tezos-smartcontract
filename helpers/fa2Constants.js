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
        notNrWlAdmin: 'FA2_NOT_NON_REVOCABLE_WHITELIST_ADMIN',
        newNrWlAdminNotWlAdmin:
            'FA2_NEW_NON_REVOCABLE_WHITELIST_ADMIN_NOT_WHITELIST_ADMIN',
        callerIsNonRevocableWlAdmin:
            'FA2_CALLER_IS_NON_REVOCABLE_WHITELIST_ADMIN',
        onlyWlrCanAddWld: 'FA2_ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS',
        senderNotWhitelisted: 'FA2_SENDER_NOT_WHITELISTED',
        receiverNotWhitelisted: 'FA2_RECEIVER_NOT_WHITELISTED',
    },
};
