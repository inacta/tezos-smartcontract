(* Storage type for the tzip-12 tutorial smart contract *)
(* Alias types to new names for better readability *)
type token_owner is address;
type token_lookup_id is token_owner; // If changing contract to handle multiple assets,
type token_balance is nat;
type token_balances is big_map(token_owner, token_balance);
type storage is record
    ledger: token_balances;
end;
//type storage is token_balances;

type token_id is nat;

// Transfer types
type transfer is record
    token_id : token_id;
    amount : token_balance;
    from_ : token_owner;
    to_ : token_owner;
end;

type transfer_param is list(transfer);

// Balance_of types
type balance_of_request is record
    owner: token_owner;
    token_id: token_id;
end;

// type balanceOfRequest = {
//     owner: tokenOwner,
//     token_id: tokenId,
// };

type balance_of_response is record
    request: balance_of_request;
    balance: token_balance;
end;

// type balanceOfResponse = {
//     request: balanceOfRequest,
//     balance: tokenBalance,
// };

type balance_of_callback is contract(list(balance_of_response));

// type balanceOfCallback = contract(list(balanceOfResponse));

type balance_of_parameter is record
    requests: list(balance_of_request);
    callback: balance_of_callback;
end;

// type balanceOfParameter = {
//     requests: list(balanceOfRequest),
//     callback: balanceOfCallback,
// };

type balance_of_request_michelson is michelson_pair_right_comb(balance_of_request);

// type balanceOfRequestMichelson = michelson_pair_right_comb(balanceOfRequest);

type balance_of_response_auxiliary is record [
    balance: token_balance;
    request: balance_of_request_michelson;
]

// type balanceOfResponseAuxiliary = {
//     request: balanceOfRequestMichelson,
//     balance: tokenBalance
// };

type balance_of_response_michelson is michelson_pair_right_comb(balance_of_response_auxiliary);

// type balanceOfResponseMichelson = michelson_pair_right_comb(balanceOfResponseAuxiliary);

type balance_of_callback_michelson is contract(list(balance_of_response_michelson));

// type balanceOfCallbackMichelson = contract(list(balanceOfResponseMichelson));

type balance_of_parameter_auxiliary is record [
    requests: list(balance_of_request_michelson);
    callback: balance_of_callback_michelson;
]

// type balanceOfParameterAuxiliary = {
//     requests: list(balanceOfRequestMichelson),
//     callback: balanceOfCallbackMichelson
// };

type balance_of_parameter_michelson is michelson_pair_right_comb(balance_of_parameter_auxiliary);

// type balanceOfParameterMichelson = michelson_pair_right_comb(balanceOfParameterAuxiliary);

type action is
| Transfer of transfer_param
| Balance_of of balance_of_parameter_michelson

function get_with_default_nat(const option : option(nat); const default : nat) : nat
    is case option of
        | Some(value) -> value
        | None -> default
    end

// Handle Balance_of requests
const default_token_balance: token_balance = 0n;
function get_token_balance (var token_id: token_id; var token_owner: token_owner; var storage: storage) : token_balance
 is begin
    if token_id =/= 0n then failwith("FA2_TOKEN_UNDEFINED") else skip; // This token contract only supports a single, fungible asset
    const ledger: token_balances = storage.ledger;
    const token_lookup_id: token_lookup_id = token_owner; // If token should handle multiple assets, change to tuple (token_id, token_owner)
    const token_balance: option(token_balance) = Map.find_opt(token_lookup_id, ledger);
    const ret: token_balance = get_with_default_nat(token_balance, default_token_balance);
 end with ret

type balance_of_requests_iterator_accumulator is (list(balance_of_response_michelson) * storage);
function balance_of_requests_iterator (var acc: balance_of_requests_iterator_accumulator; var balance_of_request_michelson: balance_of_request_michelson) : balance_of_requests_iterator_accumulator
 is begin
    // TODO: This would be prettier with pattern matching (balance_of_responses, storage) = acc;
    const balance_of_responses: list(balance_of_response_michelson) = acc.0;
    const storage: storage = acc.1;
    const balance_of_request: balance_of_request = Layout.convert_from_right_comb(balance_of_request_michelson);
    const token_balance: token_balance = get_token_balance(balance_of_request.token_id, balance_of_request.owner, storage);
    const balance_of_response_auxiliary: balance_of_response_auxiliary = record [
        request = balance_of_request_michelson;
        balance = token_balance;
    ];
    const balance_of_response_michelson: balance_of_response_michelson = Layout.convert_to_right_comb((balance_of_response_auxiliary: balance_of_response_auxiliary));
    var ret: list(balance_of_response_michelson) := balance_of_response_michelson # balance_of_responses; // # is the cons operator
 end with(ret, storage)

function balance_of (const balance_of_parameter_michelson : balance_of_parameter_michelson; var storage : storage) : (list(operation) * storage)
 is block {
    const balance_of_parameter: balance_of_parameter_auxiliary = Layout.convert_from_right_comb(balance_of_parameter_michelson);
    var balance_of_responses := List.fold (balance_of_requests_iterator, balance_of_parameter.requests, ((nil: list(balance_of_response_michelson)), storage));
    const callback_operation: operation = Tezos.transaction(balance_of_responses.0, 0tez, balance_of_parameter.callback);
  } with (list [callback_operation], storage)

function transfer (const transfer_param : transfer_param; var storage : storage) : (list(operation) * storage)
 is begin
    function transfer_iterator (const storage : storage; const transfer : transfer) : storage
        is begin
            (* You're only allowed to transfer your own tokens *)
            if sender =/= transfer.from_ then failwith("Address from_ needs to be equal to the sender") else skip;
            (* Allow transfer only if the sender has a sufficient balance *)
            if get_with_default_nat(storage.ledger[transfer.from_], default_token_balance) < transfer.amount then failwith("Insufficient balance") else skip;
            (* Update the ledger accordingly *)
            storage.ledger[transfer.from_] := abs(get_with_default_nat(storage.ledger[transfer.from_], default_token_balance) - transfer.amount);
            storage.ledger[transfer.to_] := get_with_default_nat(storage.ledger[transfer.to_], default_token_balance) + transfer.amount;
        end with storage;

    storage := list_fold(transfer_iterator, transfer_param, storage);
 end with ((nil : list(operation)), storage)

(* Default function that represents our contract, it's sole purpose here is the entrypoint routing *)
function main (const action : action; var storage : storage) : (list(operation) * storage)
    is (case action of
    (*
        Unwrap the `Transfer(...)` parameters and invoke the transfer function.
        The return value of `transfer(...)` is then returned as a result of `main(...)` as well.
     *)
    | Transfer(transfer_param) -> transfer(transfer_param, storage)
    | Balance_of(balance_of_parameter_michelson) -> balance_of(balance_of_parameter_michelson, storage)

    (* This is just a placeholder *)
    // | U -> ((nil : list(operation)), storage)
    end)
