const { User } = require("./../model/user");

let authenticate = (req, res, next) => {
  const token = req.get("Authorization");
  User.findByToken(token)
    .then(user => {
      if (!user) {
        return Promise.reject();
      }
      req.user = user;
      req.token = token;
      next();
    })
    .catch(e => {
      res.status(401).send();
    });
};

module.exports = {
  authenticate
};
