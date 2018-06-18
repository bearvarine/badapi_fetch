// Class Logger - Pat Patterson
//
// This class handles indented debug logging for single-threaded programs.
// If trace is true, PUSH() and POP() cause function names to be pushed onto or popped off of
// an internal stack, and logged text indented according to stack depth.
// If trace is false, PUSH() and POP() do nothing and logged text is not indented.

"use strict";

var clogger;

const LOG_LEVEL = {
    LOG    : 0,   // always logs
    ALWAYS : 0,   // always logs
    ERROR  : 1,
    WARN   : 2,
    INFO   : 3,   // default setting
    DEBUG  : 4,   // tracing and assert is enabled for all debug levels
    DEBUG1 : 5,
    DEBUG2 : 6,
    DEBUG3 : 7,
    DEBUG4 : 8,   // most detailed debug level
    NEVER  : 9    // never logs
};

// Max JSON pretty-print depth (%K log format option only)
const MAX_PP_DEPTH = 16;

// class-level variables:
var next_instance_id = 0;

// show instance id:
var show_iid = 0;

// Creates a unique Logger object.
//   show_instance_id - Show the instance_id in the log.
//   instance_id      - Set the default instance id.
//   init_log_level   - Set the initial log level.
//   trace            - Enable function tracing: 0=off 1=on
//   assert           - Enable assert tests: 0=off 1=on
function Logger (show_instance_id, instance_id, init_log_level, trace, assert) {

    var log_level        = init_log_level;
    var use_timestamp    = true;                        // Default true.  Can be changed to false via set_timestamp (false)
    var cslevel          = 0;                           // This is the call stack level, which increases by 1 for each function call.
    var csname           = [];                          // Array holding function/method names for each stack level.
    var csindent         = "";                          // Indent text (with optional nesting level indicators).
    var iid              = "";                          // Space-padded right-justified csiid (call stack instance id)
    var iid_pad          = 6;                           // Instance id width padding (default value)
    var csiid            = (instance_id  ?  instance_id  :  (next_instance_id  ?  next_instance_id  :  0));   // optional user-supplied instance id.

    // Manage Instance ID:
    iid              = _rjsf (csiid, iid_pad);
    next_instance_id = (isNaN (csiid)  ?  0  :  csiid + 1);
    show_iid         = (show_instance_id  ?  show_instance_id  :  0);

    // ----------------
    // Public Interface
    // ----------------

    // Pseudo-Methods: (may be reassigned to _no_op based on log_level or trace values)

    this.LOG         = _log_output;
    this.LOG_ALWAYS  = _log_output;
    this.LOG_ERROR   = _log_output;
    this.LOG_WARNING = _log_output;
    this.LOG_INFO    = _log_output;
    this.LOG_DEBUG   = _log_output;
    this.LOG_DEBUG1  = _log_output;
    this.LOG_DEBUG2  = _log_output;
    this.LOG_DEBUG3  = _log_output;
    this.LOG_DEBUG4  = _log_output;
    this.LOG_NEVER   = _no_op;

    this.ASSERT      = _log_assert;
    this.PUSH        = _log_push;
    this.POP         = _log_pop;

    // Get the current internal log_level setting:
    this.get_log_level = function () {
        return log_level;
    };

    // Map the various log functions to either log () or no-op,
    // based on the new_log_level provided:
    this.set_log_level = function (new_log_level) {

        log_level = new_log_level;

        this.LOG_ERROR   = (log_level >= LOG_LEVEL.ERROR   ?  _log_output  :  _no_op);
        this.LOG_WARNING = (log_level >= LOG_LEVEL.WARN    ?  _log_output  :  _no_op);
        this.LOG_INFO    = (log_level >= LOG_LEVEL.INFO    ?  _log_output  :  _no_op);
        this.LOG_DEBUG   = (log_level >= LOG_LEVEL.DEBUG   ?  _log_output  :  _no_op);
        this.LOG_DEBUG1  = (log_level >= LOG_LEVEL.DEBUG1  ?  _log_output  :  _no_op);
        this.LOG_DEBUG2  = (log_level >= LOG_LEVEL.DEBUG2  ?  _log_output  :  _no_op);
        this.LOG_DEBUG3  = (log_level >= LOG_LEVEL.DEBUG3  ?  _log_output  :  _no_op);
        this.LOG_DEBUG4  = (log_level >= LOG_LEVEL.DEBUG4  ?  _log_output  :  _no_op);
    };

    this.set_log_level (log_level);

    // Map the PUSH and POP functions to either _log_push()/_log_pop() or no-op,
    // based on the new_trace provided:
    this.set_trace = function (new_trace) {

        trace = new_trace;

        this.PUSH = (trace  ?  _log_push  :  _no_op);
        this.POP  = (trace  ?  _log_pop   :  _no_op);
    };

    this.set_trace (trace);


    // Map the ASSERT function to either _log_assert () or no-op,
    // based on the new_assert provided:
    this.set_assert = function (new_assert) {

        assert = new_assert;

        this.ASSERT = (assert  ?  _log_assert  :  _no_op);
    };

    this.set_assert (assert);


    // If you don't want a timestamp, set to false.
    this.set_timestamp = function (flag) {

        use_timestamp = flag;
    };


    // Get the current instance id value.
    this.get_instance_id = function () {

        return csiid;
    };


    // Set the instance id value. If show_iid is true, it will print before the log data.
    // instance_id may be set to an alphanumeric.
    this.set_instance_id = function (instance_id) {

        csiid = instance_id;

        iid = _rjsf (csiid, iid_pad);
    };


    // Get the instance id space padding
    this.get_iid_pad = function () {

        return iid_pad;
    };


    // Set the instance id space padding
    this.set_iid_pad = function (pad) {

        iid_pad = pad;

        iid = _rjsf (csiid, iid_pad);
    };


    // ------------------
    // Internal Functions
    // ------------------

    // Empty function used to short-circuit unwanted calls to logging or tracing functions.
    function _no_op () { };


    // Push a function name onto the logger's call stack.  Arglist is optional.
    // - name    - required - name of function to push onto the logger call stack.
    // - arglist - optional - string holding selected arg values to print.
    //           - may be a text string or an array [] holding a format string and variable list, suitable for util.format ().
    //             Format tokens: %s - String, %d - Number (both integer and float), %j - JSON, %J - JSON (pretty-printed).
    //                            %% - single percent sign ('%'). This does not consume an argument.
    //                            If the placeholder does not have a corresponding argument, the placeholder is not replaced.
    //
    function _log_push (name, arglist) {

        csname[cslevel] = name;

        cslevel += 1;

        var arg_text = (arglist === undefined  ?  ""  :  (Array.isArray (arglist)  ?  _fmt.apply (this, arglist)  :  arglist));

        _log (csindent + "> " + name + " (" + arg_text + ")");

        csindent += "| ";
    };


    // Pop a function name off the logger's call stack.
    // - name   - optional - name of function popped
    // - retval - optional text string or an array [] holding a format string and variable list, suitable for util.format ().
    //            Format tokens: %s - String, %d - Number (both integer and float), %j - JSON, %J - JSON (pretty-printed).
    //                           %% - single percent sign ('%'). This does not consume an argument.
    //                           If the placeholder does not have a corresponding argument, the placeholder is not replaced.
    function _log_pop (name, retval) {

        var pop_name = csname.pop ();

        if (name !== undefined)
        {
            if (pop_name === undefined)  pop_name = name;  // scenario: turn on trace mid-stream

            if (name.length  &&  name != pop_name)
            {
                _log (csindent + "logger.POP(): ERROR: expected='" + name + "', actual='" + pop_name + "'");
            }
        }

        if (cslevel > 0)  cslevel -= 1;  // scenario: turn on trace mid-stream

        csindent = csindent.substring (0, csindent.length - 2);

        var ret_text = (retval === undefined  ?  ""  :  (Array.isArray (retval)  ?  _fmt.apply (this, retval)  :  retval));

        _log (csindent + "< " + pop_name + " ()" + (ret_text  ?  " returns " + ret_text  :  ""));
    };


    // Our very own assert function.
    // - if condition is false, throws an error with the provided message.
    // - message can be a text string or an array holding a formatted message with args.
    // NOTE: does nothing if the log_level is less than LOG_LEVEL.DEBUG.
    function _log_assert (condition, message) {

        if (! condition)
        {
            var out_msg = "Assertion Failed: ";

            out_msg += (message  ?  (Array.isArray (message)  ?  _fmt.apply (this, message)  :  message)  :  "");

            _log (csindent + out_msg);

            throw new Error (out_msg + "\n");
        }
    };


    // Log 'logdata' via the _log (function).
    // - logdata - may be a text string or an array [] holding a format string and variable list, suitable for util.format ().
    //     Format tokens:
    //       %d  - numeric types
    //       %s  - string types
    //       %j  - JSON objects - in-line printed (minified) via JSON.stringify()
    //       %J  - JSON objects - indent printed via JSON.stringify()
    //       %k  - JSON objects - indent printed via _stringify()
    //       %kN - JSON objects - indent printed via _stringify() to depth N
    //       %K  - JSON objects - indent printed and sorted via _stringify()
    //       %KN - JSON objects - indent printed and sorted via _stringify() to depth N
    //       %% - single percent sign ('%'). This does not consume an argument.
    //     If the placeholder does not have a corresponding argument, the placeholder is not replaced.
    // - If trace is true, the log text will be indented.
    // - Returns the formatted output, minus indenting.
    function _log_output (logdata) {

        var outstr = (Array.isArray (logdata)  ?  _fmt.apply (this, logdata)  :  logdata);

        _log (csindent + outstr);

        return outstr;
    };


    // Internal logging function.
    function _log (text) {

        var timestamp = (use_timestamp  ?  new Date().toLocString() + " "  :  "");

        if (show_iid)
        {
            timestamp += "id=" + iid + "  ";
        }

        console.log (timestamp + text);
    };
};


// ----------------
// Helper Functions
// ----------------

if (!Date.prototype.toLocString) {  // more than 2X faster than moment()
    (function() {

        Date.prototype.toLocString = function() {

            return this.getFullYear()                          +
                "/" + ("0"  + (this.getMonth() + 1)).slice(-2) +
                "/" + ("0"  + this.getDate()).slice(-2)        +
                " " + ("0"  + this.getHours()).slice(-2)       +
                ":" + ("0"  + this.getMinutes()).slice(-2)     +
                ":" + ("0"  + this.getSeconds()).slice(-2)     +
                "." + ("00" + this.getMilliseconds()).slice(-3);
        };
    }());
}


// Right-justify-space-fill
function _rjsf (number, size) {

    return Array (Math.max (size - String (number).length + 1, 0)).join (0) + number;
};


var format_regexpr = /%([sdjJ%]|[kK]\d*)/g;

// This function takes a logger.log () printf-like format string and an argument list
// and generates a printable return string from them.
//   %d  - numeric types
//   %s  - string types
//   %j  - JSON objects - in-line printed (minified) via JSON.stringify()
//   %J  - JSON objects - indent printed via JSON.stringify()
//   %k  - JSON objects - indent printed via _stringify()
//   %kN - JSON objects - indent printed via _stringify() to depth N
//   %K  - JSON objects - indent printed and sorted via _stringify()
//   %KN - JSON objects - indent printed and sorted via _stringify() to depth N
//   %%  - single percent sign ('%'). This does not consume an argument.
function _fmt (f) {

    var ret_str;
    var args = arguments;        // capture _fmt arguments for use in in-line fns below
    var len  = args.length;      // count of _fmt arguments

    // Object not a format string w args?
    if (typeof f !== "string")
    {
        ret_str = inline_stringify_array ([], 0);
    }
    else
    {
        var i   = 1;             // increment for each replaced token
        var mxd = MAX_PP_DEPTH;  // default max depth for %K

        // Do the format string token replacement:
        ret_str = String (f).replace (format_regexpr, token_replacer_fn);

        // Any unused parameters following the format string?
        if (i < len)
        {
            ret_str = inline_stringify_array ([ret_str], i);
        }
    }

    return ret_str;


    function inline_stringify_array (objs, ix0) {

        for (var j = ix0;  j < len;  j++)
        {
            objs.push (JSON.stringify (args[j]));
        }

        return objs.join (", ");
    };


    function token_replacer_fn (x) {

        if (x === "%%")  return "%";

        if (i >= len)  return x;        // in this case we have no parameter to replace token with

        if (x.length > 2)
        {
            mxd = x.substring (2);      // extract the max depth count from the token
            x   = x.substring (0, 2);   // remove the max depth count from the token
        }

        switch (x)
        {
            case "%s": return String (args[i++]);
            case "%d": return Number (args[i++]);
            case "%j": return JSON.stringify (args[i++]);                  // built-in JSON in-line (minified) stringify
            case "%J": return JSON.stringify (args[i++], 0, 4);            // built-in JSON indented stringify
            case "%k": return _stringify (args[i++], "", 0, mxd, false);   // custom JSON stringify, depth control
            case "%K": return _stringify (args[i++], "", 0, mxd, true);    // custom JSON stringify, depth control, sorted
            default  : return x;
        }
    };
};


// Custom JSON.stringify() that does not crash when encountering complex objects
// - obj       - object to stringify
// - indent    - current indent level  (invoke with "") - 4 space indent
// - depth     - current depth         (invoke with 0)
// - max_depth - do not descend deeper than this depth.
// - sort      - If true, sort objects and arrays.
function _stringify (obj, indent, depth, max_depth, sort) {

    var out;

    var obj_is_array = Array.isArray (obj);

    if (typeof obj === "object")
    {
        if (obj === null)
        {
            // null object
            out = "null";
        }
        else if (Object.keys(obj).length === 0)
        {
            // empty object
            out = (obj_is_array ? "[]" : "{}");
        }
        else if (depth >= max_depth)
        {
            // Maximum depth reached
            out = (obj_is_array ? "[ ... ]" : "{ ... }");
        }
        else
        {
            out = (obj_is_array ? "[" : "{") + "\n";

            var child_obj = null;

            var indent2 = indent + "    ";

            var multi = "";

            if (sort)
            {
                var keys = (obj_is_array  ?  obj.sort()  :  Object.keys(obj).sort());

                var len  = keys.length;

                for (var i = 0;  i < len;  i++)
                {
                    var name = keys[i];

                    try
                    {
                        child_obj = (obj_is_array ? name : obj[name]);
                    }
                    catch (e)
                    {
                        child_obj = "<Unable to Evaluate>";
                    }

                    _stringify_child_obj ();
                }
            }
            else
            {
                for (var name in obj)
                {
                    try
                    {
                        child_obj = obj[name];
                    }
                    catch (e)
                    {
                        child_obj = "<Unable to Evaluate>";
                    }

                    _stringify_child_obj ();
                }
            }

            out += "\n" + indent + (obj_is_array ? "]" : "}");
        }
    }
    else
    {
        out = _stringify_leaf (obj);
    }

    return out;

    /// End of code execution, this function

    function _stringify_child_obj () {

        out += multi + indent2 + (obj_is_array ? "" : _stringify_leaf (name) + ": ");

        if (typeof child_obj === "object")
        {
            out += _stringify (child_obj, indent2, depth + 1, max_depth, sort);
        }
        else
        {
            out += _stringify_leaf (child_obj);
        }

        if (! multi)  multi = ",\n";
    }
}


// Format a JSON element as a leaf name or value for _stringify ()
// - leaf - a JSON element - name or value
function _stringify_leaf (leaf) {

    var out;

    var type = typeof leaf;

    if (type === "string")
    {
        out = '"' + leaf + '"';
    }
    else if (type === "number" || type === "boolean" || type === "undefined")
    {
        out = leaf;
    }
    else if (leaf === null)
    {
        out = "null";
    }
    else  // function, object, symbol, undefined, <impl-dep>
    {
        out = "<" + type + ">";
    }

    return out;
};


// Concatenate "something" to itself <count> times.
// - something - a string to be concatentated.
// - count - number of times to concatenate it to itself.
function _concat (something, count) {
    return new Array (count).join (something);
}


if (typeof exports !== "undefined")
{
    // Server-side only:
    exports.Logger    = Logger;
    exports.LOG_LEVEL = LOG_LEVEL;
}
else
{
    // Web console: Initialize the clogger obj:
    clogger = new Logger (0, 0, config.log_level, config.trace, config.assert);
}

