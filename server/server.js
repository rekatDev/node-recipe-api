require("./config/config");

const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const _ = require("lodash");
const cors = require("cors");
const path = require("path");

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
    const filename = new Date().toISOString() + "-" + file.originalname;
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
  Recipe.find().then(
    recipes => {
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
        console.log(recipeData.ingredients);
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

  Recipe.deleteOne({
    _id: id,
    _creator: req.user._id
  })
    .then(recipe => {
      if (!recipe) {
        const error = new Error("Recipe not found");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({
        recipe
      });
    })
    .catch(e => {
      res.status(e.statusCode).json({
        message: e.message
      });
    });
});

app.post("/users", (req, res) => {
  const body = _.pick(req.body, ["email", "password"]);
  const user = new User(body);

  user
    .save()
    .then(() => {
      res.status(200).json({
        user
      });
    })
    .catch(e => {
      console.log(e);
      res.status(400).send();
    });
});

app.post("/users/login", (req, res) => {
  const body = _.pick(req.body, ["email", "password"]);

  User.findByCredentials(body.email, body.password).then(user => {
    return user
      .genAuthToken()
      .then(token => {
        res.header("Authorization", token).send({
          token,
          user
        });
      })
  }).catch(e => {
    res.status(404).json({
      message: e.message
    });
  });;
});

app.delete("/users/me/token", authenticate, (req, res) => {
  const user = req.user;
  user.removeToken(req.token).then(
    user => {
      res.send();
    },
    err => {
      res.status(400).send();
    }
  );
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
