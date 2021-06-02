const express = require('express');
const app = express();

const bodyParser = require('body-parser');

app.use(bodyParser.json());

const handlebars = require('express-handlebars').create({
  defaultLayout:'main',
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.use('/boats', require('./boats.js'));
app.use('/loads', require('./loads.js'));
app.use('/users', require('./users.js'));
app.use('/', require('./login.js'));

app.enable('trust proxy');

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
