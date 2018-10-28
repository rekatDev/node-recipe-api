const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const _ = require("lodash");

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: 1,
    validate: {
      validator: validator.isEmail,
      message: "{VALUE} is not a valid email"
    },
    unique: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  shoppingList: [
    {
      name: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true
      }
    }
  ],
  tokens: [
    {
      access: {
        type: String,
        required: true
      },
      token: {
        type: String,
        required: true
      }
    }
  ]
});
UserSchema.methods.toJSON = function() {
  const user = this;
  const userObject = user.toObject();

  return _.pick(userObject, ["email", "_id", "shoppingList"]);
};

UserSchema.methods.genAuthToken = function() {
  const user = this;
  const access = "auth";

  const token = jwt.sign({ _id: user._id, access }, "secret!!").toString();
  user.tokens = user.tokens.concat([
    {
      access,
      token
    }
  ]);

  return user.save().then(() => {
    return token;
  });
};

UserSchema.methods.removeToken = function(token) {
    const user = this;

    return user.updateOne({
        $pull: {
            tokens: {
                token: token
            }
        }
    });
};

UserSchema.statics.findByToken = function(token) {
  const User = this;
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, "secret!!");
  } catch (e) {
    return Promise.reject(e);
  }
  return User.findOne({
    _id: decodedToken._id,
    "tokens.token": token,
    "tokens.access": decodedToken.access
  });
};

UserSchema.statics.findByCredentials = function(email, password) {
  const User = this;

  return User.findOne({ email }).then(user => {
    if (!user) {
      return Promise.reject("Email not found");
    }
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if (!res) {
          reject("Password incorect!");
        }
        resolve(user);
      });
    });
  });
};

UserSchema.pre("save", function(next) {
  const user = this;

  if (user.isModified("password")) {
    bcrypt
      .genSalt(10)
      .then(salt => {
        return bcrypt.hash(user.password, salt);
      })
      .then(hash => {
        user.password = hash;
        next();
      });
  } else {
    next();
  }
});

const User = mongoose.model("User", UserSchema);

module.exports = {
  User
};
