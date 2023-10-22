var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.redirect("/catalog");
});

// router.get("/catalog", function (req, res, next) {
//   res.render("index", { title: "the Library" });
// });

module.exports = router;
