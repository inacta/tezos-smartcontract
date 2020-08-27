#include "../partials/fa2_types.ligo"

(***** actions -- defines available endpoints *****)
// The abreviation 'wl' for whitelist is used since Tezos limits type constructors to
// a maximum length of 32 charactes
type action is
| Transfer of transfer_param
| Balance_of of balance_of_parameter_michelson
| Update_operators of update_operators_parameter
| Token_metadata_registry of token_metadata_registry_parameter

type storage is record
    ledger: ledger;
    token_metadata: big_map(token_id, token_metadata);
end;

// No additional checks are imposed here
function transfer_allowed(const from_ : address ; const to_ : address ; const token_id: token_id; const storage : storage) : unit is Unit;

#include "../partials/fa2_base.ligo"


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
