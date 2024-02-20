const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const url = require('url');
// Import the Stytch NPM package
const stytch = require('stytch');

// Import the .env file into environment variables
require('dotenv').config();

// Set up the basic Express.js application.
const app = express();
const port = process.env.PORT;

// Configure the Stytch B2B client using the Project ID and Secret in the
// environment variables.
const client = new stytch.B2BClient({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
});

// Configure middlewares for the Express.js application
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Add middleware to protect all routes starting with `/protected`
app.use(async (req, res, next) => {
  // Since this middleware will run on all requests, first check that 
  // the request is for a protected route. If it's not, just let the
  // request continue without checking auth.
  if (!req.path.toLowerCase().startsWith('/protected')) {
    next();
    return;
  }

  // If we get here, it means that the route is a protected route,
  // so we need to check if the user is authenticated using the Stytch
  // SDK.
  try {
    // Check if the session is valid
    const response = await client.sessions.authenticate({
      session_jwt: req.cookies.session,
    });

    // It's possible that checking if the user is authenticated might
    // have returned a new Session JWT, so we recreate the session cookie
    // with whatever Session JWT was returned from the Stytch SDK.
    res.cookie('session', response.session_jwt, {
      httpOnly: true,
      maxAge: 1000 * 60 * process.env.SESSION_DURATION_MINUTES,
    });

    // Retrieve the ip_address custom claim to log it.
    const ipAddress = response.member_session.custom_claims.ip_address;
    console.log(`IP Address: ${ipAddress}`);

    // If we get here, it means the user is authenticated and can continue
    // with the request.
    next();
  } catch (e) {
    // If the user is not authenticated, redirect them to the home page to
    // log in.
    console.error('Error authenticating session while accessing a protected page:', e);
    res.redirect('/');
  }
});

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

// Handles the login or signup form submission. This route is called when the
// user submits their email address to log in or sign up.
app.post('/login-or-signup', async (req, res) => {
  try {
    // Retrieve all the parameters needed to send a magic link, including generating
    // the Magic Link URL itself.
    const organizationId = process.env.STYTCH_ORGANIZATION_ID;
    const email = req.body.email;
    const magicLinkUrl = `${process.env.BASE_URL}/authenticate`;

    // Send the magic link in an email to the user.
    await client.magicLinks.email.loginOrSignup({
      organization_id: organizationId,
      email_address: email,
      login_redirect_url: magicLinkUrl,
      signup_redirect_url: magicLinkUrl,
    });

    res.render('email-sent');
  } catch (e) {
    // If an error occurs, render the error page.
    console.error('An error occurred while sending the magic link:', e);
    res.render('error');
  }
});

// Handles the magic link authentication. This route is called when the user
// clicks the magic link in their email.
app.get('/authenticate', async (req, res) => {
  try {
    // Retrieve the token from the query parameters and use it to authenticate
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

    // Create a new session cookie containing the Session JWT returned by the
    // `authenticate` method above. This cookie will be used to authenticate
    // the user when they request protected pages.
    res.cookie('session', response.session_jwt, {
      httpOnly: true,
      maxAge: 1000 * 60 * process.env.SESSION_DURATION_MINUTES,
    });

    // If the user successfully logged in, redirect them to the `/protected`
    // page.
    res.redirect('/protected');
  } catch (e) {
    // If an error occurs, render the error page.
    console.error('An error occurred while authenticating the magic link:', e);
    res.render('error');
  }
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
