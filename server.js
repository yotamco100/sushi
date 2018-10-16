
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const User = require('./models/user');

const app = express();
app.set('port', 80);
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
        res.render('login');
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;
        
            User.findOne({ where: {username: username } }).then(function (user) {
                console.log(user);
                if(!user) {
                    res.redirect('/login');
                } else if (!user.validPassword(password)) {
                    res.redirect('/login');
                } else {
                    req.session.user = user.dataValues;
                    res.redirect('/dashboard');
                }
            });
    });

// route for user's dashboard
app.get('/dashboard', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.render('dashboard', {username:req.session.user.username});
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
        res.render('settings', {username:req.session.user.username, twitter:"Not Supported Yet."})
    } else {
        res.redirect('/login');
    }
});

// route for handling 404
app.use(function (req, res, next) {
    res.status(404).send("Sorry, can't find that!");
});


// start the server
app.listen(app.get('port'), () => console.log(`Server started on port ${app.get('port')}`));