module.exports = function(){
    const express = require('express');
    const router = express.Router();
    const {Datastore} = require('@google-cloud/datastore');

    const model_functions = require('./model_functions.js');

    const datastore = new Datastore();

    function check_accept_header(req, res, next) {
        const accepts = req.accepts(['application/json']);
        if(!accepts) {
            res.status(406).send(JSON.parse('{"Error": "This endpoint can only return JSON"}'));
        } else {
            next();
        }
    }

    router.use(check_accept_header);

    /* ------------- Begin Controller Functions ------------- */

    router.get('/', async function(req, res){
        const loads = await model_functions.get_loads(req)
        await Promise.all(loads.results.map(async load => {
            load.self = `${req.protocol}://${req.get("host")}${req.baseUrl}/${load.id}`
            load.carrier = await model_functions.get_load_carrier(load, req);
        }));
        res.status(200).json(loads);
    });

    router.get('/:id', async function(req, res){
        const key = datastore.key([model_functions.LOAD, parseInt(req.params.id,10)]);
        datastore.get(key, async (err, entity) => {
            if(!entity) {
                res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists"}'));
            } else {
                load = await model_functions.format_load(entity, req);
                res.status(200).send(load);
            }
        });
    });

    router.post('/', async function(req, res){
        if(req.body.volume && req.body.content){
            const key = await model_functions.post_load(req.body.volume, req.body.carrier || null, req.body.content)
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    console.log(`Error getting created load: ${key.id}`);
                } else {
                    load = await model_functions.format_load(entity, req);
                    res.status(201).send(load);
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.put('/:id', function(req, res){
        if(req.body.volume && req.body.content){
            const key = datastore.key([model_functions.LOAD, parseInt(req.params.id,10)]);
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists"}'));
                } else {
                    await model_functions.update_load(req.params.id, req.body.volume, entity.carrier || null, req.body.content)
                    datastore.get(key, async (err, entity) => {
                        if(!entity) {
                            console.log(`Error getting updated load: ${key.id}`);
                        } else {
                            load = await model_functions.format_load(entity, req);
                            res.status(200).send(load);
                        }
                    });
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.patch('/:id', function(req, res){
        if(req.body.volume && req.body.content) {
            res.status(400).send(JSON.parse('{"Error": "The request object contains both volume and content. Please use the PUT /loads/:load_id endpoint."}'));
        } else if(req.body.volume || req.body.content) {
            const key = datastore.key([model_functions.LOAD, parseInt(req.params.id,10)]);
            datastore.get(key, async (err, entity) => {
                if(!entity) {
                    res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists"}'));
                } else {
                    await model_functions.update_load(req.params.id,
                                                      req.body.volume  || entity.volume,
                                                      entity.carrier   || null, 
                                                      req.body.content || entity.content)
                    datastore.get(key, async (err, entity) => {
                        if(!entity) {
                            console.log(`Error getting patched load: ${key.id}`);
                        } else {
                            load = await model_functions.format_load(entity, req);
                            res.status(200).send(load);
                        }
                    });
                }
            });
        } else {
            res.status(400).send(JSON.parse('{"Error": "The request object is missing at least one of the required attributes"}'));
        }
    });

    router.delete('/:id', async function(req, res){
        const key = datastore.key([model_functions.LOAD, parseInt(req.params.id,10)]);
        datastore.get(key, async (err, entity) => {
            if(!entity) {
                res.status(404).send(JSON.parse('{"Error": "No load with this load_id exists"}'));
            } else {
                await model_functions.delete_load(req.params.id);
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

    /* ------------- End Controller Functions ------------- */

    return router;
}();