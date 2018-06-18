/// Tweet Fetch Service Startup:
//
"use strict";

// Load in our configuration:
var config       = require ("./config");

// Load in our logging tools:
var Loglib       = require ("./logger/logger.js");
var logger       = new Loglib.Logger (0, 0, config.log_level, config.trace, config.assert);
var LOG_LEVEL    = logger.get_log_level ();

logger.LOG_INFO ("APP-0000: Starting Tweet Fetch Service");

// Create a global logger object:
config.rt.logger    = logger;     // share this object globally
config.rt.LOG_LEVEL = LOG_LEVEL;  // share this object globally

logger.LOG_INFO   (["APP-0002: version          = %s", config.version]);
logger.LOG_INFO   (["APP-0004: revision         = %s", config.revision]);
logger.LOG_INFO   (["APP-0006: log_level        = %s", config.log_level]);
logger.LOG_INFO   (["APP-0008: trace            = %s", config.trace]);
logger.LOG_INFO   (["APP-0010: assert           = %s", config.assert]);
logger.LOG_DEBUG2 (["APP-0012: process.versions = %j", process.versions]);

// ----------------------------------------------------------------
process.title = "TweetFetchService";

//process.stdin.resume ();  // Keep program alive

// do something when app is closing
process.on ("exit", exitHandler.bind (null, {exit : true}));

// catches Ctrl+C event
process.on ("SIGINT", exitHandler.bind (null, {cleanup : true}));

// catches uncaught exceptions (not catching, prefer to see the ugly details)
//process.on ("uncaughtException", exitHandler.bind (null, {exit : true}));

// ----------------------------------------------------------------
config.rt.tweet_fetcher = require ("./tweet_fetcher/tweet_fetcher.js");

config.rt.tweet_fetcher.Main ();

function exitHandler (options, err) {

    logger.PUSH ("exitHandler");

    if (options.exit)
    {
        logger.LOG_INFO (["APP-0901: exiting\n%s", (new Array(80).join("-"))]);

        process.exit ();
    }

    if (options.cleanup)
    {
        logger.LOG_INFO ("APP-0902: exiting - cleanup");
    }

    if (err)
    {
        logger.LOG_ERROR (["APP-0903: exiting - err=%j", err]);
    }

    logger.POP ("exitHandler");
};

// returned by: require (app.js):
module.exports = { "config": config };

logger.LOG_INFO (["APP-0098: Tweet Fetcher Service app launch finished\n%s", (new Array(80).join("-"))]);

