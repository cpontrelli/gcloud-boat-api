module.exports = function(){
    const express = require('express');
    const router = express.Router();

    const util = require('util');
    const url = require('url');
    const querystring = require('querystring');
    const dotenv = require('dotenv');
    const passport = require('passport');
    const Auth0Strategy = require('passport-auth0');
    const session = require('express-session');

    // config express-session
    const sess = {
        secret: 'CHANGE THIS TO A RANDOM SECRET',
        cookie: {},
        resave: false,
        saveUninitialized: true
    };

    if (router.get('env') === 'production') {
        // Use secure cookies in production (requires SSL/TLS)
        sess.cookie.secure = true;

        // Uncomment the line below if your application is behind a proxy (like on Heroku)
        // or if you're encountering the error message:
        // "Unable to verify authorization request state"
        // app.set('trust proxy', 1);
    }

    router.use(session(sess));
    
    dotenv.config();
    
    // Configure Passport to use Auth0
    const strategy = new Auth0Strategy(
        {
            domain: process.env.AUTH0_DOMAIN,
            clientID: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            callbackURL:
                process.env.AUTH0_CALLBACK_URL || 'http://localhost:8080/callback'
        },
        function (accessToken, refreshToken, extraParams, profile, done) {
        // accessToken is the token to call Auth0 API (not needed in the most cases)
        // extraParams.id_token has the JSON Web Token
        passport.session.JWT = extraParams.id_token;
        // profile has all the information from the user
        return done(null, profile);
        }
    );
    
    passport.use(strategy);
    
    router.use(passport.initialize());
    router.use(passport.session());
    
    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    
    passport.deserializeUser(function (user, done) {
        done(null, user);
    });
    
    const secured = function (req, res, next) {
        if (req.user) { return next(); }
        req.session.returnTo = req.originalUrl;
        res.redirect('/login');
    };
    
    // BEGIN Login Routes
    
    router.get('/', passport.authenticate('auth0', {
        scope: 'openid email profile'
    }), function (req, res) {
        res.redirect('/');
    });
    
    // Perform the final stage of authentication and redirect to previously requested URL or '/user'
    router.get('/callback', function (req, res, next) {
        passport.authenticate('auth0', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) { return res.redirect('/'); }
        req.logIn(user, function (err) {
            if (err) { return next(err); }
            const returnTo = req.session.returnTo;
            delete req.session.returnTo;
            res.redirect(returnTo || '/userinfo');
        });
        })(req, res, next);
    });
    
    // Perform session logout and redirect to homepage
    router.get('/logout', (req, res) => {
        req.logout();
    
        var returnTo = req.protocol + '://' + req.get('host');
        var logoutURL = new url.URL(
        util.format('https://%s/v2/logout', process.env.AUTH0_DOMAIN)
        );
        var searchString = querystring.stringify({
        client_id: process.env.AUTH0_CLIENT_ID,
        returnTo: returnTo
        });
        logoutURL.search = searchString;
        res.redirect(logoutURL);
    });
    
    /* GET user profile. */
    router.get('/userinfo', secured, function (req, res, next) {
        let context = {};
        context.name = req.user.displayName;
        context.JWT = passport.session.JWT;
        res.render('userInfo', context);
    });
  
  // END Login routes

    return router;
}();