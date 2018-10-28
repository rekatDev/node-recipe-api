const mongoose = require("mongoose");

const RecipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imgPath: {
    type: String,
    required: true
  },
  ingredients: [
    {
      name: {
        type: String,
        required: true
      }
    }
  ],
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const Recipe = mongoose.model("Recipe", RecipeSchema);

module.exports = {
  Recipe
};
