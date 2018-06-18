// Tweet Fetch Service Configuration:
var config = {
    log_level                 : 3,              // 0-ALWAYS 1-ERROR 2-WARN 3-INFO 4-DEBUG 5-DEBUG1 6-DEBUG2 7-DEBUG3 8-DEBUG4 9-NEVER (See logger.js)
                                                //   DEBUG  - temp use only, reserved for quick troubleshooting tasks
                                                //   DEBUG1 - code branching/navigation data viewing
                                                //   DEBUG2 - calculated values of interest
                                                //   DEBUG3 - larger data structures of interest
                                                //   DEBUG4 - repetitive and/or extra verbose logging, passwords
                                                //   NEVER  - internal use only - turn off a log message without commenting out.

    trace                     : 0,              // Function Tracing: 0-OFF  1-ON (See logger.js)
    assert                    : 0,              // Assert Tests: 0-OFF  1-ON (See logger.js)

    version                   : "1.0.0",        // Tweet Fetch Service product version

    tweet_api                 : "https://badapi.iqvia.io/api/v1/Tweets",  // Data source

    fetch_start_date          : "2016-01-01T00:00:00Z",                   // Data fetch start timestamp
    fetch_end_date            : "2017-12-31T23:59:59.9999999Z",           // Data fetch end   timestamp

    max_fetch_length          : 100,                                      // Maximum return record count

    output_file               : "tweets.log",                             // Output file name

    rt : {                                      // Runtime section - program may add/remove elements in this area:
        LOG_LEVEL             : undefined,      // Holds run-time pointer to LOG_LEVEL table.
        logger                : undefined,      // Holds run-time pointer to global logger object.
        tweet_fetcher         : undefined       // Holds run-time pointer to tweet_fetcher object.
    }
};

// The module.exports construct makes config a global singleton object.
module.exports = config;

