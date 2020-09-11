const Express = require('express');
const BodyParser = require('body-parser')

const Bill = require('./routes/bill.route'); // Imports routes for the companies

const App = Express();

App.use(BodyParser.json());
App.use(BodyParser.urlencoded({extended: false}));

// Establish the different routes
App.use('/bill', Bill);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
App.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});