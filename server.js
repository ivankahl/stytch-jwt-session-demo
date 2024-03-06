const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const url = require('url');

// Import the .env file into environment variables
require('dotenv').config();

// Set up the basic Express.js application.
const app = express();
const port = process.env.PORT;

// Configure middlewares for the Express.js application
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Renders the home page with a login screen.
app.get('/', (req, res) => {
  res.render('home');
});

// Renders the protected page. This page starts with `/protected`, so the 
// authentication middleware should stop this page from rendering if the user
// is not authenticated.
app.get('/protected', async (req, res) => {
  res.render('protected');
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
