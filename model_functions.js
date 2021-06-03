const {Datastore} = require('@google-cloud/datastore');

const datastore = new Datastore();

const BOAT = "Boat";
const LOAD = "Load";

const fromDatastore = function (item){
    item.id = item[Datastore.KEY].id;
    return item;
}

/* ------------- Boat Model Functions ------------- */
const post_boat = async function (name, type, length, owner){
    const key = datastore.key(BOAT);
    const new_boat = {"name": name, "type": type, "length": length, "owner": owner};
    await datastore.save({ "key": key, "data": new_boat });
    return key;
}

const get_boats = async function (req){
    let q = datastore.createQuery(BOAT).filter('owner', req.user.sub).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    const entities = await datastore.runQuery(q);
    results.results = entities[0].map(fromDatastore);
    if(entities[1].moreResults != Datastore.NO_MORE_RESULTS){
        results.next = `${req.protocol}://${req.get("host")}${req.baseUrl}?cursor=${entities[1].endCursor}`
    }
    return results;
}

const update_boat = function (id, name, type, length){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const boat = {"name": name, "type": type, "length": length};
    return datastore.save({"key":key, "data":boat});
}

const delete_boat = function (id){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.delete(key);
}

const remove_deleted_boat_from_loads = async function(id) {
    const q = datastore.createQuery(LOAD);
    const entities = await datastore.runQuery(q.filter('carrier', id));
    const loads = entities[0]
    if(loads.length > 0){
        await Promise.all(loads.map(async load => {
            await update_load_carrier(load[Datastore.KEY], load, null);
        }));
    }
}

const get_boat_load = async function (id, req) {
    const q = datastore.createQuery(LOAD);
    let entities = await datastore.runQuery(q.filter('carrier', id).select('__key__'));
    entities = entities[0].map(fromDatastore);
    if (entities.length == 0){
        return entities;
    } else {
        entities.forEach(load => {
            load.id = parseInt(load.id, 10); 
            load.self = `${req.protocol}://${req.get("host")}/loads/${load.id}`
        });
        return entities;
    }
}


const format_boat = async function (boat, req) {
    boat = fromDatastore(boat);
    boat.loads = await get_boat_load(boat.id, req);
    boat.self = `${req.protocol}://${req.get("host")}${req.baseUrl}/${boat.id}`
    return boat;
}

/* ------------- Load Model Functions ------------- */

const post_load = async function (volume, carrier, content){
    const key = datastore.key(LOAD);
    if (carrier) {
        carrier = carrier.toString();
    }
    const new_load = {
        "volume": volume, 
        "carrier": carrier, 
        "content": content, 
        "creation_date": new Date().toLocaleDateString()
    };
    await datastore.save({ "key": key, "data": new_load });
    return key;
}

const get_loads = async function (req){
    let q = datastore.createQuery(LOAD).limit(3);
    const results = {};
    if(Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    const entities = await datastore.runQuery(q);
    results.results = entities[0].map(fromDatastore);
    if(entities[1].moreResults != Datastore.NO_MORE_RESULTS){
        results.next = `${req.protocol}://${req.get("host")}${req.baseUrl}?cursor=${entities[1].endCursor}`
    }
    return results;
}

const update_load = function (id, volume, carrier, content){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    const load = {"volume": volume, "carrier": carrier || null, "content": content};
    return datastore.save({"key":key, "data":load});
}

const delete_load = function (id){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    return datastore.delete(key);
}

const update_load_carrier = async function (key, load, boat_id){
    if(boat_id) {
        boat_id = boat_id.toString();
    }
    load.carrier = boat_id
    return datastore.save({"key":key, "data":load});
}

const get_load_carrier = async function (load, req){
    const boat_key = datastore.key([BOAT, parseInt(load.carrier || 1, 10)]);
    let carrier = null;
    boat = await datastore.get(boat_key);
    if(boat[0]) {
        carrier = {
            "id": boat_key.id,
            "name": boat[0].name,
            "self": `${req.protocol}://${req.get("host")}/boats/${boat_key.id}`
        };
    }
    return carrier;
}

const format_load = async function (load, req) {
    load = fromDatastore(load);
    load.carrier = await get_load_carrier(load, req);
    load.self = `${req.protocol}://${req.get("host")}${req.baseUrl}/${load.id}`
    return load;
}


exports.BOAT = BOAT;
exports.LOAD = LOAD;
exports.post_boat = post_boat;
exports.get_boats = get_boats;
exports.update_boat = update_boat;
exports.delete_boat = delete_boat;
exports.remove_deleted_boat_from_loads = remove_deleted_boat_from_loads;
exports.get_boat_load = get_boat_load;
exports.format_boat = format_boat;
exports.post_load = post_load;
exports.get_loads = get_loads;
exports.update_load = update_load;
exports.delete_load = delete_load;
exports.update_load_carrier = update_load_carrier;
exports.get_load_carrier = get_load_carrier;
exports.format_load = format_load;