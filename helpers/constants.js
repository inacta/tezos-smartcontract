module.exports = {
    unit: undefined,
    rpcErrors: {
        michelson: {
            scriptRejected: "proto.005-PsBabyM1.michelson_v1.script_rejected",
            runtimeError: "proto.005-PsBabyM1.michelson_v1.runtime_error"
        }
    },
    contractErrors: {
        fromEqualToSenderAddress: "FA2_NOT_OPERATOR",
        insufficientBalance: "FA2_INSUFFICIENT_BALANCE",
        unknownTokenId: "FA2_TOKEN_UNDEFINED",
        approveOnBehalfOfOthers: "Only owner can update operators"
    }
};