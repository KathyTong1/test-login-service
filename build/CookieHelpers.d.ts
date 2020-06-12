/**
 * Sets a cookie. If we are on philly.com, we specify the domain so we can ensure that www2 subdomains work.
 *
 * @param {String} key example will be pmn-cookie or vCookie
 * @param {String} value encrypted string already processed by CryptoJS, or empty if resetting
 */
export declare function setCookie(key?: string, value?: string): void;
/**
 * Clears a cookie. Sets it to expired
 *
 * @param {String} key example will be pmn-cookie or vCookie
 */
export declare function clearCookie(key: any): void;
/**
 *  Mainly used to return the decryped user from the cookie. Returns null if no cookie, or empty cookie.
 *
 * @param {String} name will be pmn-cookie or vCookie.
 */
export declare function readCookie(name: any): string;
