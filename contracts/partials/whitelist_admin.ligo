(***** UPDATE WHITELIST ADMINS *****)
// Replace the existing non-revocable whitelist admin with a new
// We do not verify that the existing non-revocable whitelist admin
// is a whitelist admin as the contract could otherwise be initiated
// with a non-revocable whitelist admin that was not a whitelist admin
// and in this case, the non-revocable role could not be rescinded
// Since we don't have access to a controller where the above logic
// can be implemented, this was best solution I could come up with
function set_non_revocable_wl_admin(const new_non_revocable_whitelist_admin: address; var storage: storage): (list(operation) * storage) is
begin
    // We use Tezos.sender as this is the user or contract making this call.
    // Using Tezos.source would always be a user since Tezos.source is the transaction
    // originator, and the call to this contract could have gone through another contract,
    // so using Tezos.sender allows the non_revocable_whitelist_admin to be a contract
    if Tezos.sender =/= storage.non_revocable_whitelist_admin then failwith("NOT_NON_REVOCABLE_WHITELIST_ADMIN")
    else skip;

    // Ensure that the new non_revocable_whitelist_admin is already a whitelist_admin
    if not (storage.whitelist_admins contains new_non_revocable_whitelist_admin) then failwith("NEW_NON_REVOCABLE_WHITELIST_ADMIN_NOT_WHITELIST_ADMIN")
    else skip;

    // Don't allow function call if it does not affect state
    if new_non_revocable_whitelist_admin = storage.non_revocable_whitelist_admin then failwith("CALLER_CANNOT_HAND_NON_REVOCABLE_WHITELIST_ADMIN_TO_SELF")
    else skip;

    storage.non_revocable_whitelist_admin := new_non_revocable_whitelist_admin;
end with ((nil: list(operation)), storage);

// Add a new whitelist admin. The only requirement is that caller is admin
// This operation is idempotent so we don't check if the new admin is already an admin
function add_wl_admin(const new_whitelist_admin: address; const storage: storage): (list(operation) * storage) is
begin
    // Only whitelist admins can add other whitelist admins
    if not (storage.whitelist_admins contains Tezos.sender) then failwith("ONLY_WHITELIST_ADMIN_CAN_ADD_WHITELIST_ADMINS")
    else skip;

    var whitelist_admins: set(address) := storage.whitelist_admins;
    const new_whitelist_admins: set(address) = Set.add(new_whitelist_admin, whitelist_admins);
    storage.whitelist_admins := new_whitelist_admins;
end with ((nil: list(operation)), storage);

function renounce_wl_admin(const storage: storage): (list(operation) * storage) is
begin
    // Ensure that the non-revocable role does not call this method
    if Tezos.sender = storage.non_revocable_whitelist_admin then failwith("CALLER_IS_NON_REVOCABLE_WHITELIST_ADMIN")
    else skip;

    // TODO: What happens if we attempt to move something that isn't there?
    var whitelist_admins: set(address) := storage.whitelist_admins;
    const new_whitelist_admins: set(address) = Set.remove(Tezos.sender, whitelist_admins);
    storage.whitelist_admins := new_whitelist_admins;
end with ((nil: list(operation)), storage);