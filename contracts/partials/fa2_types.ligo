(***** Shared types *****)
type token_owner is address;

 // If changing contract to handle multiple assets, add token_id to token_lookup_id
type token_lookup_id is token_owner;
type token_balance is nat;

type account is record
    balance : token_balance;
    allowances: set (address);
end
type ledger is big_map(token_owner, account);
type token_id is nat;
type token_metadata is record
    token_id: token_id;
    symbol: string;
    name: string;
    decimals: nat;
    extras: map(string, string);
end

type token_id is nat;


(***** Transfer types *****)
type transfer_to is record
    token_id : token_id;
    amount : token_balance;
    to_ : token_owner;
end;

type transfer_to_michelson is michelson_pair_right_comb(transfer_to);

type transfer_from is record
    from_ : token_owner;
    txs: list(transfer_to_michelson);
end;

type transfer_from_michelson is michelson_pair_right_comb(transfer_from);

type transfer_param is list(transfer_from_michelson);

(***** Balance_of types *****)
type balance_of_request is record
    owner: token_owner;
    token_id: token_id;
end;

type balance_of_response is record
    request: balance_of_request;
    balance: token_balance;
end;

type balance_of_callback is contract(list(balance_of_response));

type balance_of_parameter is record
    requests: list(balance_of_request);
    callback: balance_of_callback;
end;

type balance_of_request_michelson is michelson_pair_right_comb(balance_of_request);

type balance_of_response_auxiliary is record [
    balance: token_balance;
    request: balance_of_request_michelson;
]

type balance_of_response_michelson is michelson_pair_right_comb(balance_of_response_auxiliary);

type balance_of_callback_michelson is contract(list(balance_of_response_michelson));

type balance_of_parameter_auxiliary is record [
    requests: list(balance_of_request_michelson);
    callback: balance_of_callback_michelson;
]

type balance_of_parameter_michelson is michelson_pair_right_comb(balance_of_parameter_auxiliary);


(***** Update_operators types *****)
type token_operator is address;

type operator_parameter is record [
    owner: token_owner;
    operator: token_operator;
]

type update_operators_add_or_remove is
// There's an extra `_p` in the constructors below to avoid 'redundant constructor' error
// due to the interop type conversions below
// Type constructors have to start with capital letters
| Add_operator_p of operator_parameter
| Remove_operator_p of operator_parameter

type operator_parameter_michelson is michelson_pair_right_comb(operator_parameter);

type update_operators_add_or_remove_auxiliary is
| Add_operator of operator_parameter_michelson
| Remove_operator of operator_parameter_michelson

type update_operators_add_or_remove_michelson is michelson_or_right_comb(update_operators_add_or_remove_auxiliary);

type update_operators_parameter is list(update_operators_add_or_remove_michelson);


(***** Token_metadata_registry types *****)
type token_metadata_registry_target is address;
type token_metadata_registry_parameter is contract(token_metadata_registry_target);
