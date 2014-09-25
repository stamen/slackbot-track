"use strict";

var util = require("util");

var bodyParser = require("body-parser"),
    env = require("require-env"),
    express = require("express"),
    moment = require("moment"),
    request = require("request"),
    tz = require("moment-timezone");

var app = express(),
    client = null; // mongo client

var MONGO_KEY = "time-tracking",
    SLACK_TOKEN = env.require("SLACK_TOKEN"),
    TZ = "America/Los_Angeles", // TODO look this up per user
    TZ_OFFSET = tz.tz(TZ)._offset,
    VERBS = {
      "/tell": ["asked", "tell"],
      "/ask": ["told", "ask"]
    };

moment.lang("en-custom", {
  calendar : {
    lastDay: "[yesterday at] LT",
    sameDay: "[today at] LT",
    nextDay: "[tomorrow at] LT",
    lastWeek: "[last] dddd [at] LT"
  },
  longDateFormat : {
    LT: "h:mma"
  }
});

app.use(bodyParser.urlencoded());

app.post("/", function(req, res, next) {
  // TODO validate token (as a filter)

  if (req.body.text === "") {
    return res.send("To have me track time for you, /track <time> <channel>");
  }

  var parts = req.body.text.split(" "),
      who = req.body.user_name,
      time = parts.shift(),
      channel = parts.shift(),
      cmd = VERBS[req.body.command];

  if (!who || !time || !channel) {
    return res.send("Um, I couldn't figure out when you meant.");
  }

  // add to mongo + add times

  return client.zadd(REDIS_KEY,
                     score,
                     JSON.stringify(reminder),
                     function(err) {
    if (err) {
      return next(err);
    }

    return res.send(201, util.format("Ok, I'll %s %s %s %s.",
                                     verbs[1],
                                     who,
                                     body,
                                     moment(score).zone(TZ_OFFSET).calendar()));
  });
});

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
