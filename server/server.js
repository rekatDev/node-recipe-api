require("./config/config");

const fs = require("fs");
const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const _ = require("lodash");
const cors = require("cors");
const path = require("path");
const { body, check, validationResult } = require("express-validator/check");

const { mongoose } = require("./db/db");
const { Recipe } = require("./model/recipe");
const { User } = require("./model/user");
const { authenticate } = require("./middleware/authenticate");

const app = express();
const port = process.env.PORT;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    const filename =
      new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use("/images", express.static(path.join(__dirname, "../images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, PUT, OPTIONS"
  );
  res.setHeader("Access-Control-Expose-Headers", "Authorization");
  next();
});

app.get("/recipes", (req, res) => {
  Recipe.find()
    .populate("_creator")
    .then(
      recipes => {
        console.log(recipes);
        res.status(200).json({
          recipes
        });
      },
      err => {
        res.status(400).send();
      }
    );
});

app.post(
  "/recipes",
  authenticate,
  multer({ storage: storage, fileFilter: fileFilter }).single("image"),
  (req, res) => {
    const url = req.protocol + "://" + req.get("host");
    const recipeData = JSON.parse(req.body.recipe);

    const recipe = new Recipe({
      title: recipeData.title,
      description: recipeData.description,
      imgPath: url + "/images/" + req.file.filename,
      ingredients: recipeData.ingredients,
      _creator: req.user._id
    });

    recipe
      .save()
      .then(recipe => {
        return User.findById(recipe._creator);
      })
      .then(user => {
        user.recipes.push(recipe);
        return user.save();
      })
      .then(result => {
        res.status(201).json({
          recipe
        });
      })
      .catch(e => {
        res.status(400).send();
      });
  }
);

app.get("/recipes/:id", (req, res) => {
  const id = req.params.id;

  Recipe.findById(id)
    .populate("_creator")
    .then(recipe => {
      if (!recipe) {
        const error = new Error("Recipe not found");
        error.statusCode = 404;
        throw error;
      }

      res.json(recipe);
    })
    .catch(e => {
      res.status(e.statusCode).json({
        message: e.message
      });
    });
});

app.patch(
  "/recipes/:id",
  authenticate,
  multer({ storage: storage, fileFilter: fileFilter }).single("image"),
  (req, res) => {
    let recipeData;
    let imgPath;
    if (req.file) {
      const url = req.protocol + "://" + req.get("host");
      imgPath = url + "/images/" + req.file.filename;
      recipeData = JSON.parse(req.body.recipe);
    } else {
      recipeData = req.body;
      imgPath = recipeData.imgPath;
    }

    //const ingredients = [];
    //recipeData.ingredients.forEach(ingredient => {
    //  ingredients.push({
    //    _id: ingredient._id || mongoose.Schema.Types.ObjectId(),
    //    name: ingredient.name
    //  });
    //});
    const recipe = {
      title: recipeData.title,
      description: recipeData.description,
      imgPath: imgPath,
      ingredients: recipeData.ingredients
    };

    Recipe.findOne({ _id: req.params.id, _creator: req.user._id })
      .then(recipe => {
        if (!recipe) {
          const error = new Error("Recipe not found");
          error.statusCode = 404;
          throw error;
        }
        if (recipe.imgPath !== recipeData.imgPath) {
          clearImage(recipe.imgPath);
        }
        recipe.title = recipeData.title;
        recipe.description = recipeData.description;
        recipe.imgPath = imgPath;
        recipe.ingredients = recipeData.ingredients;

        return recipe.save();
      })
      .then(recipe => {
        res.status(200).send({ recipe });
      })
      .catch(e => {
        if (e.statusCode) {
          res.status(e.statusCode).json({
            message: e.message
          });
        } else {
          res.status(500).json({
            message: "Something went wrong!"
          });
        }
      });
    // Recipe.findOneAndUpdate(
    //   { _id: req.params.id, _creator: req.user._id },
    //   { $set: recipe },
    //   { new: true }
    // )
    //   .then(recipe => {
    //     if (!recipe) {
    //       const error = new Error("Recipe not found");
    //       error.statusCode = 404;
    //       throw error;
    //     }

    //     res.status(200).send({ recipe });
    //   })
    //   .catch(e => {
    //     if (e.statusCode) {
    //       res.status(e.statusCode).json({
    //         message: e.message
    //       });
    //     } else {
    //       res.status(500).json({
    //         message: "Something went wrong!"
    //       });
    //     }
    //   });
  }
);

app.delete("/recipes/:id", authenticate, (req, res) => {
  const id = req.params.id;
  let deletedRecipe;
  Recipe.findOne({
    _id: id,
    _creator: req.user._id
  })
    // Recipe.deleteOne({
    //   _id: id,
    //   _creator: req.user._id
    // })
    .then(recipe => {
      if (!recipe) {
        const error = new Error("Recipe not found");
        error.statusCode = 404;
        throw error;
      }
      deletedRecipe = recipe;
      return Recipe.findByIdAndDelete(recipe._id);
    })
    .then(result => {
      clearImage(result.imgPath);
      return User.findById(req.user._id);
    })
    .then(user => {
      user.recipes.pull(id);
      return user.save();
    })
    .then(result => {
      res.status(200).json({
        recipe: deletedRecipe
      });
    })
    .catch(e => {
      console.log(e);
      res.status(e.statusCode || 500).json({
        message: e.message
      });
    });
});

app.post(
  "/users",
  [
    // username must be an email
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom(value => {
        return User.findOne({ email: value }).then(user => {
          if (user) {
            return Promise.reject("Email already exists");
          }
        });
      }),
    body("username")
      .not()
      .isEmpty()
      .custom(value => {
        return User.findOne({ username: value }).then(user => {
          if (user) {
            return Promise.reject("Username already exists");
          }
        });
      })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed!");
      error.statusCode = 422;
      error.data = errors.array();
      error.message = errors
        .array()
        .map(entry => entry.msg)
        .join(" ");
      throw error;
    }

    const body = _.pick(req.body, ["email", "password", "username"]);
    const user = new User(body);
    user
      .save()
      .then(() => {
        return res.status(200).json({
          user
        });
      })
      .catch(e => {
        if (e.statusCode) {
          res.status(e.statusCode).send(e);
        } else {
          return res.status(400).send(e);
        }
      });
  }
);

app.post("/users/login", (req, res) => {
  const body = _.pick(req.body, ["email", "password"]);

  User.findByCredentials(body.email, body.password)
    .then(user => {
      return user.genAuthToken().then(token => {
        res.header("Authorization", token).send({
          token,
          user
        });
      });
    })
    .catch(e => {
      res.status(404).json({
        message: e
      });
    });
});

app.delete("/users/me/token", authenticate, (req, res) => {
  const user = req.user;
  user.removeToken(req.token).then(
    user => {
      res.send({
        email: user.email,
        username: user.username
      });
    },
    err => {
      res.status(400).send();
    }
  );
});

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;

  res.status(status).send({ status, message, data });
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

const clearImage = filePath => {
  const array = filePath.split(path.sep);
  const index = array.indexOf("images");
  filePath = path.join(__dirname, "..", array[index], array[index + 1]);

  fs.unlink(filePath, err => console.log(err));
};
