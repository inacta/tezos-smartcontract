(***** UPDATE WHITELISTEDS *****)
function update_whitelisteds(const update_whitelisteds_parameter: update_whitelisteds_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisteds_iterator (var storage: storage; const update_whitelisteds_add_or_remove_michelson: update_whitelisteds_add_or_remove_michelson): storage is
    begin
        function update_whitelisteds ( var storage: storage; const whitelist_element: whitelist_element ; const add: bool): storage is
        begin
            var whitelisteds: big_map(address, set(nat)) := storage.whitelisteds;
            if add then block {
                // check if address is already a key in the big_map(address, set(nat)) mapping
                whitelisteds[whitelist_element.address] := case whitelisteds[whitelist_element.address] of
                    | Some(token_ids) -> Set.add(whitelist_element.token_id, token_ids)
                    | None -> (set [whitelist_element.token_id]: set(nat))
                end;
            };
            else block {
                whitelisteds[whitelist_element.address] := case whitelisteds[whitelist_element.address] of
                    | Some(token_ids) -> Set.remove(whitelist_element.token_id, token_ids)
                    | None -> (set []: set(nat))
                end;
            };

            storage.whitelisteds := whitelisteds;

        end with storage;

        const update_whitelisteds_add_or_remove: update_whitelisteds_add_or_remove = Layout.convert_from_right_comb(update_whitelisteds_add_or_remove_michelson);
        const ret: storage = case update_whitelisteds_add_or_remove of
            | Add_whitelisted(whitelist_element) -> update_whitelisteds(storage, whitelist_element, True)
            | Remove_whitelisted(whitelist_element) -> update_whitelisteds(storage, whitelist_element, False)
        end
    end with ret;

    // We do not check if the address is already whitelisted/already removed. This functionality
    // mimics the function to update operators
    if not (storage.whitelisters contains Tezos.sender) then failwith("FA2_ONLY_WHITELISTERS_CAN_UPDATE_WHITELISTEDS")
    else skip;

    storage := List.fold(update_whitelisteds_iterator, update_whitelisteds_parameter, storage);

end with ((nil: list(operation)), storage);


(***** UPDATE WHITELISTERS *****)
function update_whitelisters(const update_whitelisters_parameter: update_whitelisters_parameter ; var storage: storage) : (list(operation) * storage) is
begin
    function update_whitelisters_iterator (var storage: storage; var update_whitelisters_add_or_remove_michelson: update_whitelisters_add_or_remove_michelson): storage is
    begin
        function update_whitelisters ( var storage: storage; var whitelister: address ; const add: bool): storage is
        begin
            var whitelisters: set(address) := storage.whitelisters;
            if add then block {
                whitelisters := Set.add(whitelister, whitelisters);
            };
            else block {
                whitelisters := Set.remove(whitelister, whitelisters);
            };

            storage.whitelisters := whitelisters;
        end with storage;

        const update_whitelisters_add_or_remove: update_whitelisters_add_or_remove = Layout.convert_from_right_comb(update_whitelisters_add_or_remove_michelson);
        const ret: storage = case update_whitelisters_add_or_remove of
            | Add_whitelister(whitelister) -> update_whitelisters(storage, whitelister, True)
            | Remove_whitelister(whitelister) -> update_whitelisters(storage, whitelister, False)
        end
    end with ret;

    if not (storage.whitelist_admins contains Tezos.sender) then failwith("FA2_ONLY_WHITELIST_ADMIN_CAN_UPDATE_WHITELISTERS")
    else skip;
    storage := List.fold(update_whitelisters_iterator, update_whitelisters_parameter, storage);

end with ((nil: list(operation)), storage);
