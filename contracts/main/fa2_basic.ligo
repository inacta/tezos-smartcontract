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
type storage is record
    ledger: ledger;
    token_metadata: big_map(token_id, token_metadata);
end;

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


(***** actions -- defines available endpoints *****)
// The abreviation 'wl' for whitelist is used since Tezos limits type constructors to
// a maximum length of 32 charactes
type action is
| Transfer of transfer_param
| Balance_of of balance_of_parameter_michelson
| Update_operators of update_operators_parameter
| Token_metadata_registry of token_metadata_registry_parameter


(***** UPDATE_OPERATORS *****)
function can_update_operators (var token_owner: token_owner; var storage : storage) : unit is
begin
    if Tezos.sender =/= token_owner then failwith("Only owner can update operators") else skip;
end with Unit;

function get_account (const addr : address; const storage : storage) : account is
  block {
    var acct : account :=
      record [
        balance = 0n;
        allowances = (set []: set(address));
      ];
    case storage.ledger[addr] of
      None -> skip
    | Some(instance) -> acct := instance
    end;
  } with acct

function update_operators (const update_operators_parameter: update_operators_parameter; var storage: storage) : (list(operation) * storage) is
begin
    function update_operators_iterator (var storage: storage; var update_operators_add_or_remove_michelson: update_operators_add_or_remove_michelson): storage is
    begin
        function update_operators (var storage: storage; var operator_parameter_michelson: operator_parameter_michelson; const add: bool): storage is
        begin
            var operator_parameter: operator_parameter := Layout.convert_from_right_comb(operator_parameter_michelson);
            const unit_value: unit = can_update_operators((operator_parameter.owner, storage));

            const account : account = get_account(operator_parameter.owner, storage);

            var allowances: set(address) := account.allowances;

            if add then block {
                allowances := Set.add(operator_parameter.operator, allowances);
            };
            else block {
                allowances := Set.remove(operator_parameter.operator, allowances);
            };

            account.allowances := allowances;
            storage.ledger[operator_parameter.owner] := account;
        end with storage;

        const update_operators_add_or_remove_auxiliary: update_operators_add_or_remove_auxiliary = Layout.convert_from_right_comb(update_operators_add_or_remove_michelson);
        const ret: storage = case update_operators_add_or_remove_auxiliary of
            | Add_operator(operator_parameter_michelson) -> update_operators(storage, operator_parameter_michelson, True)
            | Remove_operator(operator_parameter_michelson) -> update_operators(storage, operator_parameter_michelson, False)
        end
    end with ret;

    storage := List.fold(update_operators_iterator, update_operators_parameter, storage);
end with ((nil: list(operation)), storage);


(***** BALANCE_OF *****)
function account_balance_with_default_nat(const account_option: option(account); const default: nat) : nat is
    case account_option of
        | Some(value) -> value.balance
        | None -> default
end;

const default_token_balance: token_balance = 0n;
function get_token_balance (var token_id: token_id; var token_owner: token_owner; var storage: storage) : token_balance is
begin
    if token_id =/= 0n then failwith("FA2_TOKEN_UNDEFINED") else skip; // This token contract only supports a single, fungible asset
    const ledger: ledger = storage.ledger;
    const token_lookup_id: token_lookup_id = token_owner; // If token should handle multiple assets, change to tuple (token_id, token_owner)
    const account: option(account) = Map.find_opt(token_lookup_id, ledger);
    const token_balance: token_balance = account_balance_with_default_nat(account, default_token_balance);
end with token_balance;

type balance_of_requests_iterator_accumulator is (list(balance_of_response_michelson) * storage);
function balance_of (const balance_of_parameter_michelson : balance_of_parameter_michelson; var storage : storage) : (list(operation) * storage)
is begin
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
    end with(ret, storage);

    const balance_of_parameter: balance_of_parameter_auxiliary = Layout.convert_from_right_comb(balance_of_parameter_michelson);
    var balance_of_responses := List.fold (balance_of_requests_iterator, balance_of_parameter.requests, ((nil: list(balance_of_response_michelson)), storage));
    const callback_operation: operation = Tezos.transaction(balance_of_responses.0, 0tez, balance_of_parameter.callback);
end with (list [callback_operation], storage);


// No additional checks are imposed here
function transfer_allowed(const from_ : address ; const to_ : address ; const storage : storage) : unit is Unit;

(***** TRANSFER *****)
// Throw iff Tezos.source (transcation originator) has not been granted access to spend from spender
function is_allowed ( const spender : address ; var s : storage) : unit is
begin
    if Tezos.sender =/= spender then block {
        const src: account = case s.ledger[spender] of
           Some (acc) -> acc
           | None -> (failwith("NoAccount"): account)
        end;

        case src.allowances contains Tezos.sender of
            True -> skip
            | False -> failwith("FA2_NOT_OPERATOR")
        end;
    };
    else skip;
end with Unit;

// TODO: This is very ineffective in terms of gas, big optimizations should be possible
function transfer (const transfer_param : transfer_param; var storage : storage) : (list(operation) * storage) is
begin
    function inner_transfer_iterator (const storage_from_tuple: storage * token_owner; const transfer_to_michelson : transfer_to_michelson) : storage * token_owner
        is begin
            const storage : storage = storage_from_tuple.0;
            const from_ : token_owner = storage_from_tuple.1;
            (* Verify that transaction originator is allowed to spend from this address *)
            const unit_value: unit = is_allowed(from_, storage);

            const transfer_to : transfer_to = Layout.convert_from_right_comb(transfer_to_michelson);
            if transfer_to.token_id =/= 0n then failwith("FA2_TOKEN_UNDEFINED") else skip; // This token contract only supports a single, fungible asset

            const unit_value: unit = transfer_allowed(from_, transfer_to.to_, storage);

            const sender_balance: nat = get_token_balance(transfer_to.token_id, from_, storage);
            if sender_balance < transfer_to.amount then failwith("FA2_INSUFFICIENT_BALANCE") else skip;

            (* Update the ledger accordingly *)
            var sender_account := get_account(from_, storage);
            sender_account.balance := abs(sender_account.balance - transfer_to.amount);
            storage.ledger[from_] := sender_account;
            var recipient_account : account := get_account(transfer_to.to_, storage);
            recipient_account.balance := recipient_account.balance + transfer_to.amount;
            storage.ledger[transfer_to.to_] := recipient_account;
        end with (storage, from_);

    function outer_transfer_iterator (var storage : storage; const transfer_from_michelson : transfer_from_michelson) : storage
        is begin
            const transfer_from : transfer_from = Layout.convert_from_right_comb(transfer_from_michelson);
            const storage_from_tuple : storage * token_owner = List.fold(inner_transfer_iterator, transfer_from.txs, (storage, transfer_from.from_));
        end with storage_from_tuple.0;
    storage := List.fold(outer_transfer_iterator, transfer_param, storage);
end with ((nil : list(operation)), storage);


(***** TOKEN METADATA *****)
function token_metadata_registry(const token_metadata_registry_parameter: token_metadata_registry_parameter; const  storage: storage): (list(operation) * storage) is
begin
    const callback_operation: operation = Tezos.transaction(Tezos.self_address, 0tez, token_metadata_registry_parameter);
end with (list [callback_operation], storage);


(***** MAIN FUNCTION *****)
(* Default function that represents our contract, it's sole purpose here is the entrypoint routing *)
function main (const action : action; var storage : storage) : (list(operation) * storage) is
begin
    if amount =/= 0tz then failwith("This contract does not accept tezi deposits")
    else skip;
end with case action of
    | Transfer(transfer_param) -> transfer(transfer_param, storage)
    | Balance_of(balance_of_parameter_michelson) -> balance_of(balance_of_parameter_michelson, storage)
    | Update_operators(update_operators_parameter) -> update_operators(update_operators_parameter, storage)
    | Token_metadata_registry(token_metadata_registry_parameter) -> token_metadata_registry(token_metadata_registry_parameter, storage)
    end
