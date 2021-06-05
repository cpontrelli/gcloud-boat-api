module.exports = function(){
    const express = require('express');
    const router = express.Router();
    const {Datastore} = require('@google-cloud/datastore');

    const jwt = require('express-jwt');
    const jwksRsa = require('jwks-rsa');

    const model_functions = require('./model_functions.js');

    const datastore = new Datastore();

    const check_accept_header= function(req, res, next) {
        const accepts = req.accepts(['application/json', 'text/html']);
        if(!accepts) {
            res.status(406).send(JSON.parse('{"Error": "This endpoint can only return JSON or HTML"}'));
        } else {
            next();
        }
    }

    const check_jwt = jwt({
        secret: jwksRsa.expressJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `https://cs-493-final-project.us.auth0.com/.well-known/jwks.json`
        }),
      
        // Validate the audience and the issuer.
        issuer: `https://cs-493-final-project.us.auth0.com/`,
        algorithms: ['RS256']
      });

    const handle_jwt_error = function(err, req, res, next) {
        if (err.name == 'UnauthorizedError') {
        res.status(401).send(JSON.parse('{"Error": "Invalid or missing authorization token"}'));
        } else {
            next();
        }
    }

      router.use(check_jwt);
      router.use(handle_jwt_error);
      router.use(check_accept_header);

    /* ------------- Begin Controller Functions ------------- */

    router.get('/', async function(req, res){
        const boats = await model_functions.get_boats(req)
        boats.results.forEach(async (boat) => {
            boat.self = `${req.protocol}://${req.get("host")}${req.baseUrl}/${boat.id}`
            boat.load = await model_functions.get_boat_load(boat.id, req);
        });
        res.status(200).json(boats);
    });

    router.get('/:id', async function(req, res){
        const key = datastore.key([model_functions.BOAT, parseInt(req.params.id,10)]);
        datastore.get(key, async (err, entity) => {
            if(!entity) {
                res.status(404).send(JSON.parse('{"Error": "No boat with this boat_id exists"}'));
            } else if (entity.owner != req.user.sub) {
                res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
            } else {
                boat = await model_functions.format_boat(entity, req);
                res.status(200).send(boat);
            }
        });
    });

    router.post('/', async function(req, res){
        if(req.body.name && req.body.type && req.body.length){
            const key = await model_functions.post_boat(req.body.name, req.body.type, req.body.length, req.user.sub)
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    console.log(`Error getting created boat: ${key.id}`);
                } else {
                    boat = await model_functions.format_boat(entity, req);
                    res.status(201).send(boat);
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.put('/:id', function(req, res){
        if(req.body.name && req.body.type && req.body.length){
            const key = datastore.key([model_functions.BOAT, parseInt(req.params.id,10)]);
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    res.status(404).send(JSON.parse('{"Error": "No boat with this boat_id exists"}'));
                } else if (entity.owner != req.user.sub) {
                    res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
                } else {
                    await model_functions.update_boat(req.params.id, req.body.name, req.body.type, req.body.length, entity.owner)
                    datastore.get(key, async (err, entity) => {
                        if(!entity) {
                            console.log(`Error getting updated boat: ${key.id}`);
                        } else {
                            boat = await model_functions.format_boat(entity, req);
                            res.status(200).send(boat);
                        }
                    });
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.patch('/:id', function(req, res){
        if(req.body.name && req.body.type && req.body.length) {
            res.status(400).send(JSON.parse('{"Error": "The request object contains name, type, and length. Please use the PUT /boats/:boat_id endpoint."}'));
        } else if(req.body.name || req.body.type || req.body.length) {
            const key = datastore.key([model_functions.BOAT, parseInt(req.params.id,10)]);
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    res.status(404).send(JSON.parse('{"Error": "No boat with this boat_id exists"}'));
                } else if (entity.owner != req.user.sub) {
                    res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
                } else {
                    await model_functions.update_boat(req.params.id,
                                                      req.body.name   || entity.name,
                                                      req.body.type   || entity.type, 
                                                      req.body.length || entity.length,
                                                      entity.owner)
                    datastore.get(key, async (err, entity) => {
                        if(!entity) {
                            console.log(`Error getting updated boat: ${key.id}`);
                        } else {
                            boat = await model_functions.format_boat(entity, req);
                            res.status(200).send(boat);
                        }
                    });
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.put('/:boat_id/loads/:load_id', async function(req, res){
        const load_key = datastore.key([model_functions.LOAD, parseInt(req.params.load_id,10)]);
        const boat_key = datastore.key([model_functions.BOAT, parseInt(req.params.boat_id,10)]);
        datastore.get(boat_key, async (err, boat) => {
            if(!boat) {
                res.status(404).send(JSON.parse('{"Error": "The specified load and/or boat does not exist"}'));
            } else if (boat.owner != req.user.sub) {
                res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
            } else {
                datastore.get(load_key, async (err, load) => {
                    if(!load) {
                        res.status(404).send(JSON.parse('{"Error": "The specified load and/or boat does not exist"}'));
                    } else if (load.carrier) {
                        res.status(403).send(JSON.parse('{"Error": "This load is already on a boat"}'));
                    } else {
                        await model_functions.update_load_carrier(load_key, load, boat_key.id);
                        res.status(204).send();
                    }
                });
            }
        });
    });

    router.delete('/:boat_id/loads/:load_id', async function(req, res) {
        const load_key = datastore.key([model_functions.LOAD, parseInt(req.params.load_id,10)]);
        const boat_key = datastore.key([model_functions.BOAT, parseInt(req.params.boat_id,10)]);
        datastore.get(boat_key, async (err, boat) => {
            if(!boat) {
                res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists at the boat with this boat_id"}'));
            } else if (boat.owner != req.user.sub) {
                res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
            } else {
                datastore.get(load_key, async (err, load) => {
                    if(!load) {
                        res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists at the boat with this boat_id"}'));
                    } else if (load.carrier != req.params.boat_id) {
                        res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists at the boat with this boat_id"}'));
                    } else {
                        await model_functions.update_load_carrier(load_key, load, null);
                        res.status(204).send();
                    }
                });
            }
        });
    });

    router.delete('/:id', async function(req, res){
        const key = datastore.key([model_functions.BOAT, parseInt(req.params.id,10)]);
        await model_functions.remove_deleted_boat_from_loads(req.params.id);
        datastore.get(key, async (err, entity) => {
            if(!entity) {
                res.status(404).send(JSON.parse('{"Error": "No boat with this boat_id exists"}'));
            } else if (entity.owner != req.user.sub) {
                res.status(403).send(JSON.parse('{"Error": "This boat is owned by another user"}'));
            } else {
                await model_functions.delete_boat(req.params.id);
                res.status(204).send();
            }
        });
    });

    router.delete('/', function (req, res){
        res.set('Accept', 'GET, POST');
        res.status(405).end();
    });

    router.put('/', function (req, res){
        res.set('Accept', 'GET, POST');
        res.status(405).end();
    });

    router.patch('/', function (req, res){
        res.set('Accept', 'GET, POST');
        res.status(405).end();
    });

    router.post('/:id', function (req, res){
        res.set('Accept', 'GET, PUT, PATCH, DELETE');
        res.status(405).end();
    });

    router.get('/:boat_id/loads/:load_id', function (req, res){
        res.set('Accept', 'PUT, DELETE');
        res.status(405).end();
    });

    router.post('/:boat_id/loads/:load_id', function (req, res){
        res.set('Accept', 'PUT, DELETE');
        res.status(405).end();
    });

    router.patch('/:boat_id/loads/:load_id', function (req, res){
        res.set('Accept', 'PUT, DELETE');
        res.status(405).end();
    });

    /* ------------- End Controller Functions ------------- */

    return router;
}();