
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const User = require('./models/user');
const Sequelize = require('sequelize');
const Twitter = require('node-twitter-api');
const readline = require('readline');

var twitter = new Twitter({
    consumerKey: process.env.CONSUMER_TOKEN,
    consumerSecret: process.env.CONSUMER_SECRET,
    callback: process.env.CALLBACK_URL
});

var sequelizeDB = new Sequelize('mainDB', null, null, 
                                {dialect: 'sqlite',
                                 storage: "/app/SushiUsers.db"});

const app = express();
app.set('port', 8080);
app.set('view engine', 'ejs');

app.use(morgan('dev')); // for logging
app.use(bodyParser.urlencoded({ extended:true })); // parse incoming requests
app.use(cookieParser()); // allow cookie access

// track logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: 'somerandomstuffs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        express: 600000
    }
}));

// check if a user is logged in
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
  // thank u,
    next();
});

//middleware to check for logged in users
var sessionChecker = (req, res, next) => {
    if(req.session.user && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }
}

// route for homepage
app.get('/', sessionChecker, (req, res) => {
    res.render('index');
});

// route to user signup
app.route('/signup').get(sessionChecker, (req, res) => {
    res.render('signup');
}).post((req, res) => {
    User.create({
        username: req.body.username,
        password: req.body.password
    })
    .then(user => {
        req.session.user = user.dataValues;
        console.log("User creation successful.")
        res.redirect('/dashboard');
    })
    .catch(error => {
        console.log("Username:", req.body.username);
        console.log("Password:", req.body.password);
        console.log("Error:", error);
        res.redirect('/signup');
    });
});

//route to user login
app.route('/login')
    .get(sessionChecker, (req, res) => {
        res.render('login', {error:null});
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;
        
            User.findOne({ where: {username: username, disabled:0 } }).then(function (user) {
                if(!user || !user.validPassword(password)) {
                    res.render('login', {error:"Invalid username and/or password."});
                } else {
                    req.session.user = user.dataValues;
                    res.redirect('/dashboard');
                }
            });
    });

// route for user's dashboard
app.get('/dashboard', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      var posts = [];
        res.render('dashboard', {username:req.session.user.username, posts: posts});
    } else {
        res.redirect('/login');
    }
});

// route for user logout
app.get('/logout', (req, res) => {
    if(req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

//route for settings
app.get('/settings', (req, res) => {
    if(req.session.user && req.cookies.user_sid) {
        var myToken = null;
      User.findOne({ where: {username: req.session.user.username} }).then(function (oneRow) {
        console.log("dataValues.Twit: " + oneRow.dataValues.TwitterToken);
        myToken = oneRow.dataValues.TwitterToken;
        console.log("myToken: " + myToken);
        res.render('settings', {username:req.session.user.username, twitter: myToken});
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/deactivate', (req, res) => {
    User.findOne({ where: {username: req.session.user.username} }).then(function (user) {
        user.update({disabled:1});
        res.send("Account deactivated.");
        res.redirect('/logout');
    })
});

//this is for handling the posting interface
app.route('/post').get((req, res) => {
  if(req.session.user && req.cookies.user_sid) {
    res.render('post', { username: req.session.user.username });
  } else {
        res.redirect('/login');
  }})
.post((req, res) => {
    //now we process the post data and send to twitter
  req.session.lastpost = req.body.post;
  console.log(req.body.social);
  if(req.body.social !== undefined)
  {
      if(req.body.social.includes("Twitter"))
        {
            twitter.statuses("update", {
                  status: req.body.post
              },
              req.session.user.TwitterToken,
              req.session.user.TwitterSecret,
              function(error, data, response) {
                  if (error) {
                      res.send("something went wrong. Try again!");
                  }
              }
          );
        }
        if(req.body.social.includes("Facebook"))
        {
            res.redirect('/afterpost');
        }
  }
  res.redirect('/dashboard');
});

app.get('/afterpost', (req, res) => {
    if(req.session.lastpost)
    {
        res.render('afterpost', {username:req.session.user.username ,post:req.session.lastpost});
    }
    else if(req.session.user && req.cookies.user_sid)
        res.redirect('/dashboard');
    else
        res.redirect('/');
});

//this block is for twitter authentication,
var _requestSecret;

app.get('/request-token', (req, res) => {
    twitter.getRequestToken((err, requestToken, requestSecret) => {
        if(err)
          res.status(500).send(err);
        else {
          _requestSecret = requestSecret;
          res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
        }});
});

app.get('/twitter_auth_callback', (req, res) => {
  res.render('twitter_auth_callback');
});

app.get("/access-token", function(req, res) {
        var requestToken = req.query.oauth_token,
            verifier = req.query.oauth_verifier;

        twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
            if (err)
                res.status(500).send(err);
            else
                twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
                    if (err)
                        res.status(500).send(err);
                    else {
                        User.findOne({ where: {username: req.session.user.username} }).then(function (user) {
                            user.update({TwitterToken:accessToken, TwitterSecret:accessSecret});
                            res.redirect('/settings');
                        })
                    }
                });
        });
});

//this is for revoking twitter access
app.get('/revoke-twitter', (req, res) => {
           User.findOne({ where: {username: req.session.user.username} }).then(function (user) {
                            user.update({TwitterToken:null, TwitterSecret:null});
                            res.redirect('/settings');
                            });
});

// route for handling 404
app.use(function (req, res, next) {
    res.status(404).send("Sorry, can't find that!");
});


// start the server
app.listen(app.get('port'), () => console.log(`Server started on port ${app.get('port')}`));