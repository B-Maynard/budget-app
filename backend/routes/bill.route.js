const express = require('express');
const router = express.Router();

const bill_controller = require('../controllers/bill.controller');

router.get('/test', bill_controller.test);
router.post('/create', bill_controller.bill_create);

module.exports = router;