module.exports = function(){
    const express = require('express');
    const router = express.Router();
    const {Datastore} = require('@google-cloud/datastore');

    const USER = "User"

    const datastore = new Datastore();

    const fromDatastore = function (item){
        item.id = item[Datastore.KEY].name;
        return item;
    }

    const get_users = async function (){
        let q = datastore.createQuery(USER);
        let entities = await datastore.runQuery(q);
        entities = entities[0].map(fromDatastore);
        return entities;
    }

    router.get('/', async function(req, res){
        const users = await get_users()
        res.status(200).json(users);
    });

    return router;
}();