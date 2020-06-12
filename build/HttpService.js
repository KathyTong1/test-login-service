"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function toQueryString(paramsObject) {
    return Object
        .keys(paramsObject)
        .map(function (key) { return encodeURIComponent(key) + "=" + encodeURIComponent(paramsObject[key]); })
        .join('&');
}
function getEndpoint(_a) {
    var url = _a.url, data = _a.data, query = _a.query, _b = _a.method, method = _b === void 0 ? 'GET' : _b;
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        var queryString = query ? '?' + toQueryString(query) : '';
        xhr.open(method, "" + url + queryString);
        if (method === 'POST') {
            xhr.setRequestHeader('Content-type', 'application/json');
            xhr.setRequestHeader('Accept', 'application/json');
        }
        xhr.onload = function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
            }
            else {
                reject(new Error("Error hitting " + xhr.responseURL + ". Status: " + xhr.status));
            }
        };
        xhr.onerror = function () { return reject(xhr.statusText); };
        xhr.send(JSON.stringify(data));
    });
}
exports.getEndpoint = getEndpoint;
//# sourceMappingURL=HttpService.js.map