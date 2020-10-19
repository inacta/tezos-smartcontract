// Acticity balance are a mapping from an id (nat) to a balance (nat)

type storage is record
    activity_balance: map(nat, nat);
    allowed_activities: set(nat);
end;

type action is
| Update_activity_balance of (list((nat * nat)))
| Add_allowed_activity of nat

function add_allowed_activity(const new_activity: nat; var storage: storage) : (list(operation) * storage) is
begin
    if storage.allowed_activities contains new_activity then
        failwith("ACTIVITY_ALREADY_EXISTS");
    else
        skip;

    storage.allowed_activities := Set.add(new_activity, storage.allowed_activities);
end with ((nil: list(operation)), storage);

function update_activity_balance(const acitivities_and_duration: list((nat * nat)); var storage: storage): (list(operation) * storage) is
begin
    function update_activity_balance_iterator(var storage: storage ; const acitivity_and_duration: (nat * nat)): storage is
    begin
        if not (storage.allowed_activities contains acitivity_and_duration.0) then
        failwith("ACTIVITY_DOES_NOT_EXIST");
        else
            skip;
        var balance_ : nat := get_force(acitivity_and_duration.0, storage.activity_balance);
    end with storage;
end with ((nil: list(operation)), storage);

function main (const p : action ; const s : storage) :
  (list(operation) * storage) is
 block {
   // Reject any transaction that tries to transfer token to this contract
   if amount =/= 0tz then failwith ("This contract does not accept tezi deposits");
   else skip;
  } with case p of
  | Add_allowed_activity(n) -> add_allowed_activity(n, s)
  | Update_activity_balance(n) -> update_activity_balance(n, s)
  end
