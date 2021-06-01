module.exports = function(){
    const express = require('express');
    const router = express.Router();
    const {Datastore} = require('@google-cloud/datastore');

    const model_functions = require('./model_functions.js');

    const datastore = new Datastore();

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

    /* ------------- End Controller Functions ------------- */

    return router;
}();