var fs = require('fs');
var payloadChecker = require('payload-validator');

//Simple version, without validation or sanitation
exports.test = function (req, res) {
    res.send('Greetings from the Test controller!');
};

exports.bill_create = function (req, res) {

    // Make sure someone doesn't troll the files. only allow 10 different jsons to be created at a time
    fs.readdir('./data', (err, files) => {
        if (files.length >= 10) {
            res.send("There are already 10 people using this for some reason. Who's trying to access this other than the 10 people who already are?");
        }
      });

    // Validate that the payload is the correct format
    // user is string, name is string, cost is some number, due is string
    var expectedPayload = {
        "items" : [{
            "user" : "",
            "name" : "",
            "cost": 0,
            "due": ""
        }]
    };

    if (req.body) {
        var validation = payloadChecker.validator(req.body,expectedPayload,["name","message"],false);
        if(validation.success) {

            // Set up the new entry for the user
            var newEntry = {
                "items": [{
                    "user": req.body.items[0].user,
                    "name": req.body.items[0].name,
                    "cost": req.body.items[0].cost,
                    "due": req.body.items[0].due
                }]
            };

            var user = String(req.body.items[0].user).toLowerCase();

            var jsonBody = null;

            // Read the existing file for the user and make sure we append the new stuff to it
            var result = "";
            if (fs.existsSync(`./data/${user}.json`)) {
                var fileContents = fs.readFileSync(`./data/${user}.json`);

                if (fileContents.length != 0)
                    jsonBody = JSON.parse(fileContents);
    

                jsonBody["items"].push(newEntry["items"]);

                // Dont let someone flood their bills. no one should have 20 bills to their name
                if (jsonBody["items"].length > 20) {
                    result = "Re-evaluate your life choices...";
                    res.send(result);
                }
            }
            else
                jsonBody = newEntry;
        
            // Write the json string to the file
            fs.writeFileSync(`./data/${user}.json`, JSON.stringify(jsonBody), (err) => {
                if (err) {
                    result = err;
                }
                result = "File saved.";
            });
        } 
        else {
            res.json({"message" : validation.response.errorMessage});
        }
    } 
    else {
        res.json({"message" : "payload not correct"});
    }

  res.send(result);
};