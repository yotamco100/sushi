
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt');

// create a sequelize instance with local database info
var sequelizeDB = new Sequelize('mainDB', null, null, 
                                {dialect: 'sqlite',
                                 storage: "/app/SushiUsers.db"});

sequelizeDB
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });


var User = sequelizeDB.define('sushi_node_accounts', {
    username: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    FBToken: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    FBSecret: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    TwitterToken: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    TwitterSecret: {
        type: Sequelize.STRING,
        defaultValue: null
    },
    disabled: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    hooks: {
        beforeCreate: (user) => {
            const salt = bcrypt.genSaltSync();
            user.password = bcrypt.hashSync(user.password, salt);
        }
    }
});

User.prototype.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
}

// update database
sequelizeDB.sync()
           .then(() => console.log('table has been successfully created, if it doesn\'t exist already.',))
           .catch(error => console.log("Error:", error));

module.exports = User;