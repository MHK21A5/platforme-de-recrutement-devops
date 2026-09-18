const express = require("express");
const router = express.Router();

router.use("/users", require("./users"),);
router.use("/interviews", require("./interviews"));
router.use("/jobs", require("./jobs"));

module.exports = router;