function log_replace(querystring, params) {
    let replaced = "";

    for (let i = 0; i < params.length; i++) {
        replaced = querystring.replace("?", " '" + params[i] + "' ");
        querystring = replaced;
    }

    return replaced;
}

module.exports = log_replace;
