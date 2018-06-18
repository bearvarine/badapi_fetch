"use strict";

const fs         = require("fs");            // File system functions
const moment     = require("moment");        // Date object manipulation
const superagent = require("superagent");    // HTTP/S GET

var config       = require("../config.js");  // Project config file
var logger       = config.rt.logger;         // Logging object
var LOG_LEVEL    = config.rt.LOG_LEVEL;      // Current log level

logger.PUSH ("tweet_fetcher.js");

var total_count  = 0;                        // total count of all records fetched
var fetch_count  = 0;                        // count of API fetches

const ts_regex   = /([^\.]+)\.(\d+)(.+)/;    // regular expr to split timestamp

// Main program entry point:
function Main() {

    logger.PUSH("Main");

    if (fs.existsSync(config.output_file))
    {
        logger.LOG_INFO(["Output file %s detected -- deleting.", config.output_file]);

        fs.unlink(config.output_file, function (err) {
            // async callback -- new task:

            logger.PUSH("Main.unlink.cb");

            if (err) { throw err; }

            logger.LOG_INFO("- file deleted.");

            Fetch(config.fetch_start_date, config.fetch_end_date);

            logger.POP("Main.unlink.cb");
        });
    }
    else
    {
        Fetch(config.fetch_start_date, config.fetch_end_date);
    }

    logger.POP("Main");
};


// Performs the HTTPS GET query of the tweet API.
// Supply a start_date and end_date in the form:
// 2016-01-01T00:00:00Z or 2016-01-01T00:00:00.0000000Z.
// Never returns more than <config.max_fetch_length> rows.
function Fetch(start_date, end_date) {

    logger.PUSH("Fetch");
    logger.LOG_DEBUG1(["start_date='%s', end_date='%s'", start_date, end_date]);

    logger.ASSERT(start_date);
    logger.ASSERT(end_date);

    fetch_count++;

    superagent.get(config.tweet_api)
              .query({ startDate: start_date, endDate: end_date })
              .end((err, res) => {
                  // async callback -- new task:

                  logger.PUSH("Fetch.superagent.end.cb");

                  if (err) { throw err; }

                  logger.LOG_DEBUG4(["res.body: %k3", res.body]);
                  logger.LOG_DEBUG3(["- start_date='%s', end_date='%s'", start_date, end_date]);

                  Archive (res.body, start_date);

                  logger.POP("Fetch.superagent.end.cb");
              });

    logger.POP("Fetch");
};

// Identify the last received record's timestamp, determine the
// next possible timestamp instance to begin the next query,
// then archive the current received records.
// Finally, launch a new call to Fetch() to get the next set of records.
// content - a response.body from the Fetch query.
function Archive (content, start_date) {

    logger.PUSH("Archive");

    logger.LOG_DEBUG1(["start_date = %s", start_date]);
    var start_moment      = moment (start_date);

    var fetch_end_stamp   = undefined;  // Either empty or the timestamp of the last record in the current content list
    var fetch_end_moment  = undefined;  // Moment object equivalent of fetch_end_stamp, to the nearest second.

    var next_start_moment = undefined;  // Moment object equal to fetch_end_moment + 1 msec.
    var next_start_stamp  = undefined;  // Timestamp equivalent to next_srart_moment.

    var last_fetch        = (content.length != config.max_fetch_length);  // true only when API returns less data than the max permitted

    logger.LOG_DEBUG1(["content.length = %d, config.max_fetch_length = %d, last_fetch = %d",
                       content.length, config.max_fetch_length, last_fetch]);

    if (! last_fetch)
    {
        fetch_end_stamp = content[config.max_fetch_length - 1].stamp;

        logger.LOG_DEBUG1(["fetch_end_stamp = %s", fetch_end_stamp]);

        fetch_end_moment = moment (fetch_end_stamp);

        logger.LOG_DEBUG1(["fetch_end_moment = %s", fetch_end_moment.toISOString()]);

        var ra = ts_regex.exec(fetch_end_stamp);

        logger.LOG_DEBUG1(["ra=%j", ra]);

        // This should cause a 1-record overlap (deliberately):
        next_start_stamp = ra[1] + "." + ra[2] + "Z"

        logger.LOG_DEBUG1(["next_start_stamp = %s", next_start_stamp]);
    }

    // out_data holds the assembled records to be written to the output file:
    var out_data = (total_count ? "" : "[\n");

    var current_count = 0;  // count of records kept from the current Fetch:

    // Loop through the content array and append the non-duplicate records to out_data:
    content.forEach (function (record) {

        // - Ensure this record's time stamp falls after the last saved record:
        var record_moment = moment (record.stamp);

        logger.LOG_DEBUG2(["record_moment = %s, start_moment = %s",
                            record_moment.toISOString(), start_moment.toISOString()]);

        if (record_moment.isAfter (start_moment))
        {
            if (total_count)  out_data += ",\n";

            out_data += JSON.stringify (record, null, 4);

            current_count++;
            total_count++;
        }
        else
        {
            logger.LOG_DEBUG1(["- Discarding duplicate record - timestamp=%s", record.stamp]);
        }
    });

    if (last_fetch)  out_data += "\n]";

    // Append the stringified content to the output log file:
    fs.appendFile (config.output_file, out_data, "utf8", function (err) {
        // async callback -- new task:

        logger.PUSH("Archive.appendFile.cb");

        if (err) { throw err; }

        logger.LOG_INFO(["appended %d records", current_count]);

        if (last_fetch)
        {
            logger.LOG_INFO(["Done.  %d fetches.  %d records written to file %s.",
                             fetch_count, total_count, config.output_file]);
        }
        else
        {
            // Invoke the next iteration of data fetching:
            Fetch(next_start_stamp, config.fetch_end_date);
        }

        logger.POP("Archive.appendFile.cb");
    });

    logger.POP("Archive");
};

exports.Main = Main;

logger.POP("tweet_fetcher.js");

