/**
 * Encrypts a user using CryptoJS -- essentially it turns a user into a long string that can be read and turned into a user object.
 *
 * @param {Object} data User object we are encrypting into a cookie.
 */
export declare function encryptData(data: any): string;
/**
 *  Standard nullUser, used in a few places, so has been placed into a const.
 */
export declare const nullUser: {
    auth0Id: any;
    uid: any;
    displayName: any;
    email: any;
    timestamp: any;
    state: string;
    mg2Id: any;
    registrationDate: any;
    subscriptionStartDate: any;
    subscriptionExpirationDate: any;
    registrationSource: any;
    paperCode: any;
    householdLevel: any;
};
/**
 * Decrypt a user using CryptoJS. Reads a cookie, converts into a user object.
 * This function is exported and can be used anywhere you need user information.
 * If no user is found, it will return a nullUser, which you can use to do things with too.
 */
export declare function getDecryptedUser(): any;
/**
 * Set cookies for Vf and PMN. pmn-cookie used by Connext, vCookie used by Vf.
 * setTimeout is there to ensure viafoura is ready, and is effectively a hack around slowness
 * from Connext. It is at parity with current Philly setup.
 *
 * @param {Object} user standard user object
 * @param {Integer} timeout milliseconds for timeout, 0 by default
 */
export declare function setPMNAndViafouraCookies(user: any, timeout?: number): void;
/**
 *  Happens when user logs out. Clears the cookies, which is Part 1 of logging a user out.
 */
export declare function clearUser(): void;
export declare function backupAndRestoreCookiesFromLocalStorage(): void;
/**
 * If a user is logged in, we need to ensure they are in the PMNdataLayer[0].analytics object, so they are counted in the pageView event.
 * Add a masterId to the user object, per analytics requirements.
 */
export declare function addUserToDataLayer(user: any): void;
/**
 * Philly has a simple user profile API they hit early on to get a user up and running with Vf faster.
 * This is the result of Connext being too slow, so they bypass it with this function (this is also why the setTimeout is used above).
 *
 * @param {String} environment will be dev, stage, or prod
 */
export declare function fetchUserProfile(auth0Id?: any, environment?: string, callback?: Function, onError?: Function): void;
export declare function updateUserName(environment: string, data: any, callback?: Function, onError?: Function): void;
export declare function isEmpty(val: any): boolean;
/**
 * Fires in one of the Connext callbacks when a user is subscribed. Provides the proper UX.
 *
 * @param {String} btnText Usually replaced with user email (that's what appears on the button).
 */
export declare function displaySubscribedUX(btnText: string, biller: any, environment: any): void;
/**
 * Fires after user is logged in. Very similar to Subscribed, but subscribed btn not hidden.
 * TODO I bet these functions can be condensed into one.
 *
 * @param {String} btnText Usually replaced with user email (that's what appears on the button).
 */
export declare function displayLoggedInUX(btnText?: string): void;
/**
 * Fires after user is logged out. Needed because the dropdown sticks in cache.
 */
export declare function displayLoggedOutUX(): void;
/**
 * Gets user, call subscription api via callAPI()
 * @param {String} auth0Id
 * @param {String} environment dev, stage, or prod
 * @param {Function} cb optional callback function after calling API and updating user. cb takes 'user' as the only argument
 * @returns {Promise<Object>}
 */
export declare function callSubscriptionAPI(user: any, environment: any): Promise<any>;
export declare function initializePiano(user: any): void;
export declare const onPaywallShown: () => void;
export declare function showLoaderBackground(): void;
export declare function removeLoaderBackground(): void;
export declare function isCrawler(): any;
export declare function setLoginHandler(lock: any, environment: any): void;
