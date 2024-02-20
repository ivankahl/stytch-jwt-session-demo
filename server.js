const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const url = require('url');
// Import the Stytch NPM package here
const stytch = require('stytch');

// Import the .env file into environment variables
require('dotenv').config();

// Set up the basic Express.js application.
const app = express();
const port = process.env.PORT;

// Configure middlewares
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Add authentication middleware
app.use(async (req, res, next) => {
  // If this is not a protected route, just continue with the request
  if (!req.path.toLowerCase().startsWith('/protected')) {
    next();
    return;
  }

  // This is a protected route, so we need to check if the user is authenticated
  try {
    // Check if the session is valid
    const response = await client.sessions.authenticate({
      session_jwt: req.cookies.session,
    });

    // The Session JWT might have been refreshed automatically
    // so assign it to the cookie again
    res.cookie('session', response.session_jwt, {
      httpOnly: true,
      maxAge: 1000 * 60 * process.env.SESSION_DURATION_MINUTES,
    });

    // Retrieve the ip_address custom claim
    const ipAddress = response.member_session.custom_claims.ip_address;
    console.log(`IP Address: ${ipAddress}`);

    // Show the protected page if they are
    next();
  } catch (e) {
    // If not, redirect them to the home page to log in
    res.redirect('/');
  }
});

// Configure the Stytch B2B client
const client = new stytch.B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
});

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/protected', async (req, res) => {
  res.render('protected');
});

app.post('/login-or-signup', async (req, res) => {
  const organizationId = process.env.STYTCH_ORGANIZATION_ID;
  const email = req.body.email;
  const magicLinkUrl = `${process.env.BASE_URL}/authenticate`;

  await client.magicLinks.email.loginOrSignup({
    organization_id: organizationId,
    email_address: email,
    login_redirect_url: magicLinkUrl,
    signup_redirect_url: magicLinkUrl,
  });

  res.render('email-sent');
});

app.get('/authenticate', async (req, res) => {
  const { token } = url.parse(req.url, true).query;
  const response = await client.magicLinks.authenticate({
    magic_links_token: token,
    session_duration_minutes: process.env.SESSION_DURATION_MINUTES,
    // Specify custom claims for the session
    session_custom_claims: {
      // Set a value for the ip_address claim
      ip_address: req.ip,
    },
  });

  res.cookie('session', response.session_jwt, {
    httpOnly: true,
    maxAge: 1000 * 60 * process.env.SESSION_DURATION_MINUTES,
  });

  res.redirect('/protected');
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
