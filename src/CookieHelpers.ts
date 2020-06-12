/**
 * Sets a cookie. If we are on philly.com, we specify the domain so we can ensure that www2 subdomains work.
 *
 * @param {String} key example will be pmn-cookie or vCookie
 * @param {String} value encrypted string already processed by CryptoJS, or empty if resetting
 */
export function setCookie (key = '', value = ';') {
  const includeDomain = window.location.host.includes('inquirer.com');
  const domain = includeDomain ? `domain=inquirer.com;` : '';

  if (key.length > 0) {
    value = `${value.toString()};`;
    // 1 month = 2,628,000 sec
    const exp = 'max-age=2628000;';
    document.cookie = `${key.toString()}=${value}path=/;${domain}${exp}`;
  }
}

/**
 * Clears a cookie. Sets it to expired
 *
 * @param {String} key example will be pmn-cookie or vCookie
 */
export function clearCookie (key) {
  const includeDomain = window.location.host.includes('inquirer.com');
  const domain = includeDomain ? `domain=inquirer.com;` : '';
  document.cookie = key + '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;' + domain;
}

/**
 *  Mainly used to return the decryped user from the cookie. Returns null if no cookie, or empty cookie.
 *
 * @param {String} name will be pmn-cookie or vCookie.
 */
export function readCookie(name) {
  const desiredCookie = document.cookie.split(';')
    .find(cookie => cookie.trim().substring(0, name.length) === name);

  return desiredCookie ? desiredCookie.trim().substring(name.length + 1) : null;
}
