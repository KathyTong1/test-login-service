declare const XMLHttpRequest;

function toQueryString(paramsObject) {
  return Object
    .keys(paramsObject)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(paramsObject[key])}`)
    .join('&');
}

export function getEndpoint({ url, data, query, method = 'GET'}: any) {
  return new Promise(function(resolve, reject) {
    const xhr = new XMLHttpRequest();
    const queryString = query ? '?' + toQueryString(query) : '';
    xhr.open(method, `${url}${queryString}`);

    if (method === 'POST') {
      xhr.setRequestHeader('Content-type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');
    }

    xhr.onload = () => {
      if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Error hitting ${xhr.responseURL}. Status: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(xhr.statusText);

    xhr.send(JSON.stringify(data));
  });
}
