"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_js_1 = __importDefault(require("crypto-js"));
var some_1 = __importDefault(require("lodash/some"));
var user_service_configs_1 = require("./vendor-specific/user-service-configs");
var HttpService_1 = require("./HttpService");
var CookieHelpers_1 = require("./CookieHelpers");
/**
 * Encrypts a user using CryptoJS -- essentially it turns a user into a long string that can be read and turned into a user object.
 *
 * @param {Object} data User object we are encrypting into a cookie.
 */
function encryptData(data) {
    var salt = 'PMN_p3pp3r-#215';
    if (data === undefined || data === null) {
        throw new Error('Cannot encrypt empty data set');
    }
    // Hold data after determining typeof
    var dataHolder;
    // Object must be encapsulated w.in an Array
    if (typeof data === 'object') {
        dataHolder = JSON.stringify([data]);
    }
    else {
        dataHolder = data;
    }
    var cipherData = crypto_js_1.default.AES.encrypt(dataHolder, salt);
    return encodeURIComponent(cipherData);
}
exports.encryptData = encryptData;
/**
 *  Standard nullUser, used in a few places, so has been placed into a const.
 */
exports.nullUser = {
    auth0Id: null,
    uid: null,
    displayName: null,
    email: null,
    timestamp: null,
    state: 'Logged Out',
    mg2Id: null,
    registrationDate: null,
    subscriptionStartDate: null,
    subscriptionExpirationDate: null,
    registrationSource: null,
    paperCode: null,
    householdLevel: null
};
/**
 * Decrypt a user using CryptoJS. Reads a cookie, converts into a user object.
 * This function is exported and can be used anywhere you need user information.
 * If no user is found, it will return a nullUser, which you can use to do things with too.
 */
function getDecryptedUser() {
    // Use this function get the user at any state of your Connext adventure
    var salt = 'PMN_p3pp3r-#215';
    var cookieData = CookieHelpers_1.readCookie('pmn-cookie');
    if (cookieData && cookieData.length > 0) {
        var data = decodeURIComponent(cookieData);
        var decryptedBytes = crypto_js_1.default.AES.decrypt(data, salt);
        var user = JSON.parse(decryptedBytes.toString(crypto_js_1.default.enc.Utf8));
        return user[0];
    }
    else {
        return exports.nullUser;
    }
}
exports.getDecryptedUser = getDecryptedUser;
/**
 * Set cookies for Vf and PMN. pmn-cookie used by Connext, vCookie used by Vf.
 * setTimeout is there to ensure viafoura is ready, and is effectively a hack around slowness
 * from Connext. It is at parity with current Philly setup.
 *
 * @param {Object} user standard user object
 * @param {Integer} timeout milliseconds for timeout, 0 by default
 */
function setPMNAndViafouraCookies(user, timeout) {
    if (timeout === void 0) { timeout = 0; }
    var cipherPMNUser = encryptData(user);
    var displayName = user.displayName, email = user.email, uid = user.uid;
    var cipherVfUser = encryptData({ displayName: displayName, email: email, uid: uid });
    CookieHelpers_1.setCookie('pmn-cookie', cipherPMNUser);
    CookieHelpers_1.setCookie('vCookie', cipherVfUser);
    if (window.vf && window.vf.length !== 0 && window.vf.session) {
        setTimeout(function () { window.vf.session.login.cookie(CookieHelpers_1.readCookie('vCookie')); }, timeout);
    }
}
exports.setPMNAndViafouraCookies = setPMNAndViafouraCookies;
/**
 * Updates several user state cookies on the page with key/value pairs.
 *
 * @param {Object} data key/value pairs
 */
function updateUserByKeys(data) {
    if (data === void 0) { data = {}; }
    var legacyUser = getDecryptedUser();
    Object.keys(data).forEach(function (key) {
        var item = data[key];
        legacyUser[item[0]] = item[1];
    });
    legacyUser['displayName'] = data.user.user_metadata.displayName;
    setPMNAndViafouraCookies(legacyUser, 2000);
}
/**
 *  Happens when user logs out. Clears the cookies, which is Part 1 of logging a user out.
 */
function clearUser() {
    var cookiesToClear = ['pmn-cookie', 'vCookie'];
    cookiesToClear.forEach(function (key) {
        CookieHelpers_1.clearCookie(key);
        // Accessing localStorage will fail on old browsers
        try {
            localStorage.removeItem(key);
        }
        catch (e) {
            console.log('Local storage not accessible', e);
        }
    });
    if (window.vf && window.vf.session) {
        window.vf.session.logout();
    }
}
exports.clearUser = clearUser;
function backupAndRestoreCookiesFromLocalStorage() {
    var cookiesToPersist = ['pmn-cookie', 'vCookie', '__tbc', '_ga'];
    var auth0Id;
    // Accessing localStorage will fail on old browsers and Safari in Private Browsing mode
    try {
        cookiesToPersist.forEach(function (key) {
            var cookieValue = CookieHelpers_1.readCookie(key);
            if (cookieValue) {
                localStorage.setItem(key, cookieValue);
            }
            else {
                var localStorageValue = localStorage.getItem(key);
                if (localStorageValue) {
                    CookieHelpers_1.setCookie(key, localStorageValue);
                    auth0Id = auth0Id || getDecryptedUser().auth0Id;
                    window.PMNdataLayer.push({
                        'event': 'cookie-deleted',
                        'cookie-key': key,
                        'cookie-value': localStorageValue,
                        'auth0Id': auth0Id
                    });
                }
            }
        });
    }
    catch (e) {
        console.log('Local storage not accessible', e);
    }
}
exports.backupAndRestoreCookiesFromLocalStorage = backupAndRestoreCookiesFromLocalStorage;
/**
 * If a user is logged in, we need to ensure they are in the PMNdataLayer[0].analytics object, so they are counted in the pageView event.
 * Add a masterId to the user object, per analytics requirements.
 */
function addUserToDataLayer(user) {
    if (user.state && !window.pmnAdmin.disableAnalytics) {
        var masterId = user.auth0Id ? user.auth0Id.split('auth0|')[1] : null;
        user.masterId = masterId;
        window.PMNdataLayer = window.PMNdataLayer || [];
        window.PMNdataLayer[0] = window.PMNdataLayer[0] || { analytics: {} };
        window.PMNdataLayer[0].analytics.user = user;
    }
}
exports.addUserToDataLayer = addUserToDataLayer;
/**
 * Connext (also known as MG2) function that attempts to create a user object from local storage using Connext functions.
 * Largely untouched from Philly's current implementation.
 */
function buildUserFromAuthPayload(auth0Profile) {
    var user = {
        timestamp: new Date()
    };
    if (auth0Profile) {
        user.registrationDate = auth0Profile.created_at;
        user.auth0Id = auth0Profile.user_id;
        user.uid = auth0Profile.user_id;
        user.displayName = auth0Profile.user_metadata && auth0Profile.user_metadata.displayName;
        user.email = auth0Profile.email;
        user.isVerified = auth0Profile.email_verified;
    }
    return user;
}
/**
 * Philly has a simple user profile API they hit early on to get a user up and running with Vf faster.
 * This is the result of Connext being too slow, so they bypass it with this function (this is also why the setTimeout is used above).
 *
 * @param {String} environment will be dev, stage, or prod
 */
function fetchUserProfile(auth0Id, environment, callback, onError) {
    if (auth0Id === void 0) { auth0Id = null; }
    if (environment === void 0) { environment = 'prod'; }
    if (auth0Id) {
        var url = "https://" + user_service_configs_1.userServiceConfigs[environment] + "/" + encodeURI(auth0Id);
        HttpService_1.getEndpoint({ url: url })
            .then(function (data) {
            updateUserByKeys(data);
            if (callback) {
                callback(data);
            }
        });
    }
    else {
        if (onError) {
            onError(true);
        }
    }
}
exports.fetchUserProfile = fetchUserProfile;
function updateUserName(environment, data, callback, onError) {
    if (environment === void 0) { environment = 'prod'; }
    var user = getDecryptedUser();
    var url = "https://" + user_service_configs_1.userServiceConfigs[environment] + "/" + encodeURI(user.auth0Id) + "/username";
    if (user && user.auth0Id) {
        HttpService_1.getEndpoint({ url: url, data: data, query: '', method: 'POST' })
            .then(function (data) {
            updateUserByKeys(data);
            if (callback) {
                callback(data);
            }
        }).catch(function () {
            if (onError) {
                onError(true);
            }
        });
    }
}
exports.updateUserName = updateUserName;
function isEmpty(val) {
    if ((val === undefined || val == null || val.length <= 0)) {
        return true;
    }
    else {
        return false;
    }
}
exports.isEmpty = isEmpty;
function displaySubscribedFooter(auth0Id) {
    var inquirerImages = __spreadArrays(document.querySelectorAll('.inquirer-img-link'));
    var dailyImages = __spreadArrays(document.querySelectorAll('.daily-img-link'));
    var inquirerEditions = __spreadArrays(document.querySelectorAll('.inquirer-digital-edition'));
    var dailyIEditions = __spreadArrays(document.querySelectorAll('.daily-digital-edition'));
    var inquirerSubs = __spreadArrays(document.querySelectorAll('.inquirer-subscribe'));
    var dailySubs = __spreadArrays(document.querySelectorAll('.daily-subscribe'));
    var inquirerServices = __spreadArrays(document.querySelectorAll('.inquirer-subscriber-services'));
    var dailyServices = __spreadArrays(document.querySelectorAll('.daily-subscriber-services'));
    var inquirerHref = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(auth0Id);
    var dailyHref = 'https://api.inquirer.com/v1/replica/replica?edition=DailyNews&mid=' + encodeURIComponent(auth0Id);
    inquirerImages.forEach(function (image) {
        image.href = inquirerHref;
        image.id = '';
    });
    dailyImages.forEach(function (image) {
        image.href = dailyHref;
        image.id = '';
    });
    inquirerEditions.forEach(function (btn) {
        btn.classList.remove('hidden');
        btn.href = inquirerHref;
    });
    dailyIEditions.forEach(function (btn) {
        btn.classList.remove('hidden');
        btn.href = dailyHref;
    });
    inquirerSubs.forEach(function (btn) { return btn.classList.add('hidden'); });
    dailySubs.forEach(function (btn) { return btn.classList.add('hidden'); });
    inquirerServices.forEach(function (btn) { return btn.classList.remove('hidden'); });
    dailyServices.forEach(function (btn) { return btn.classList.remove('hidden'); });
}
function getManageMyAccountUrl(biller, environment) {
    var url = '';
    if (biller === 'MG2') {
        if (environment === 'prod') {
            url = "https://myaccount.inquirer.com/";
        }
        else {
            url = "https://test-myaccount.inquirer.com/";
        }
    }
    else {
        if (environment === 'prod') {
            url = "https://account.inquirer.com/";
        }
        else {
            url = "https://qa-inquirer.cs19.force.com/subscribers/s/";
        }
    }
    return url;
}
/**
 * Fires in one of the Connext callbacks when a user is subscribed. Provides the proper UX.
 *
 * @param {String} btnText Usually replaced with user email (that's what appears on the button).
 */
function displaySubscribedUX(btnText, biller, environment) {
    if (btnText === void 0) { btnText = 'My account'; }
    var userDropdowns = __spreadArrays(document.querySelectorAll('.my-account-btn'));
    var manageAccountLinks = __spreadArrays(document.querySelectorAll('.manage-account-btn a'));
    var subscribeBtns = __spreadArrays(document.querySelectorAll('.subscribe-btn'));
    var subscribeWidgets = __spreadArrays(document.querySelectorAll('.subscribe-widget'));
    var loginBtns = __spreadArrays(document.querySelectorAll('.auth0-log-in'));
    var todayBtn = document.getElementById('todayspaper');
    var user = getDecryptedUser();
    if (todayBtn) {
        todayBtn.href = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(user.auth0Id);
        todayBtn.id = '';
    }
    subscribeBtns.forEach(function (btn) { return btn.classList.add('hidden'); });
    subscribeWidgets.forEach(function (widget) { return widget.classList.add('hidden'); });
    loginBtns.forEach(function (btn) { return btn.classList.add('hidden'); });
    userDropdowns.forEach(function (btn) {
        btn.innerText = btnText;
        btn.classList.remove('hidden');
    });
    var url = getManageMyAccountUrl(biller, environment);
    manageAccountLinks.forEach(function (btn) { return btn.setAttribute("href", url); });
    displaySubscribedFooter(user.auth0Id);
}
exports.displaySubscribedUX = displaySubscribedUX;
/**
 * Fires after user is logged in. Very similar to Subscribed, but subscribed btn not hidden.
 * TODO I bet these functions can be condensed into one.
 *
 * @param {String} btnText Usually replaced with user email (that's what appears on the button).
 */
function displayLoggedInUX(btnText) {
    if (btnText === void 0) { btnText = 'My account'; }
    var userDropdowns = __spreadArrays(document.querySelectorAll('.my-account-btn'));
    var loginBtns = __spreadArrays(document.querySelectorAll('.auth0-log-in'));
    var manageAccountbtns = __spreadArrays(document.querySelectorAll('.manage-account-btn'));
    loginBtns.forEach(function (btn) { return btn.classList.add('hidden'); });
    userDropdowns.forEach(function (btn) {
        btn.innerText = btnText;
        btn.classList.remove('hidden');
    });
    manageAccountbtns.forEach(function (btn) { return btn.classList.add('hidden'); });
    // Hidden Newsletter Sign Up
    if (document.querySelector('div.global-newsletter-sign-up.only-mobile')) {
        document.querySelector('div.global-newsletter-sign-up.only-mobile').classList.add('hidden');
    }
    // Hidden Miss a Story
    if (document.querySelector('div.subscribe-widget.only-mobile')) {
        document.querySelector('div.subscribe-widget.only-mobile').classList.add('hidden');
    }
}
exports.displayLoggedInUX = displayLoggedInUX;
// TODO: make sure this doesn't fire on user update or anything like that
function refreshPage() {
    var user = getDecryptedUser();
    if (user.state === 'Subscribed' || user.state === 'Logged In') {
        if (window.isReplicaLogin && user.state === 'Subscribed') {
            // Redirect to replica page with 'replica-login' event
            if (!window.isDaily) {
                window.location.href = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(user.auth0Id);
            }
            else {
                window.location.href = 'https://api.inquirer.com/v1/replica/replica?edition=DailyNews&mid=' + encodeURIComponent(user.auth0Id);
            }
        }
        else if (document.URL.indexOf('#loaded') === -1) {
            // Only reload the page if a user was unathorized, so they get the ad lite experience
            if (document.URL.substr(document.URL.length - 2) === '/#') {
                location.href += 'loaded';
            }
            else {
                location.href += '#loaded';
            }
            location.reload(true);
        }
    }
}
/**
 * Fires after user is logged out. Needed because the dropdown sticks in cache.
 */
function displayLoggedOutUX() {
    var logoutBtns = __spreadArrays(document.querySelectorAll('.my-account-btn'));
    var loginBtns = __spreadArrays(document.querySelectorAll('.auth0-log-in'));
    var subscribeBtns = __spreadArrays(document.querySelectorAll('.subscribe-btn'));
    logoutBtns.forEach(function (btn) { return btn.classList.add('hidden'); });
    loginBtns.forEach(function (btn) { return btn.classList.remove('hidden'); });
    subscribeBtns.forEach(function (btn) { return btn.classList.remove('hidden'); });
    // Update unauthentication warning on myprofile page
    if (document.querySelector('#profile-username-access')) {
        document.querySelector('#email-read-only').classList.add('hidden');
        document.querySelector('#username-read-only').classList.add('hidden');
        document.querySelector('#profile-username-access').classList.remove('hidden');
    }
    // Show Newsletter Sign Up
    if (document.querySelector('div.global-newsletter-sign-up.only-mobile')) {
        document.querySelector('div.global-newsletter-sign-up.only-mobile').classList.remove('hidden');
    }
    // Show Miss a Story
    if (document.querySelector('div.global-newsletter-sign-up.only-mobile')) {
        document.querySelector('div.subscribe-widget.only-mobile').classList.remove('hidden');
    }
}
exports.displayLoggedOutUX = displayLoggedOutUX;
/**
 * Update User Cookie
 * @param {Object} user
 * @returns {Object}
 */
function updateUserByData(user, data) {
    user.timestamp = new Date();
    if (data) {
        if (data.isSubscriber) {
            user.state = 'Subscribed';
        }
        else {
            user.state = 'Logged In';
        }
        user.isVerified = data.isVerified;
        user.biller = data.biller;
        CookieHelpers_1.setCookie('pmn-cookie', encryptData(user));
    }
    return user;
}
/**
 * Gets user, call subscription api via callAPI()
 * @param {String} auth0Id
 * @param {String} environment dev, stage, or prod
 * @param {Function} cb optional callback function after calling API and updating user. cb takes 'user' as the only argument
 * @returns {Promise<Object>}
 */
function callSubscriptionAPI(user, environment) {
    var url = '';
    if (environment === 'dev' || environment === 'stage') {
        url = 'https://dev.api.inquirer.com/v1/auth/subscriber';
    }
    else {
        url = 'https://api.inquirer.com/v1/auth/subscriber';
    }
    return HttpService_1.getEndpoint({
        url: url,
        query: {
            auth0Id: user.auth0Id
        }
    }).then(function (data) {
        return updateUserByData(user, data);
    }, function () {
        return updateUserByData(user, false);
    });
}
exports.callSubscriptionAPI = callSubscriptionAPI;
function initializePiano(user) {
    var channel = window.PMNdataLayer[0].analytics.primarysegment || '';
    window.tp = window.tp || [];
    window.tp.push(['setCustomVariable', 'channel', channel]);
    window.tp.push(['setCustomVariable', 'userState', user.state]);
    window.tp.push(['setCustomVariable', 'isVerified', user.isVerified]);
    window.tp.push(['setTags', [user.state]]);
    window.tp.push(['init', function () {
            window.tp.experience.init();
        }]);
}
exports.initializePiano = initializePiano;
function trackLoginEvent() {
    if (window.PMNdataLayer) {
        window.PMNdataLayer.push({
            'event': 'user-login',
            'loginStatus': 'log-in'
        });
    }
}
// TODO: Fire this when Piano shows the paywall
exports.onPaywallShown = function () {
    var elements = document.querySelectorAll('.pb-f-article-comments');
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('hidden');
        elements[i].remove();
    }
};
function showLoaderBackground() {
    var backgroundDiv = document.createElement('div');
    backgroundDiv.id = 'lock-loader-background';
    document.body.appendChild(backgroundDiv);
    setTimeout(function () {
        backgroundDiv.style.opacity = 0.5;
    }, 0);
    var spinner = document.createElement('spinner');
    spinner.setAttribute('class', 'spinner');
    setTimeout(function () { return backgroundDiv.appendChild(spinner); }, 300);
}
exports.showLoaderBackground = showLoaderBackground;
function removeLoaderBackground() {
    var backgroundDiv = document.getElementById('lock-loader-background');
    if (backgroundDiv) {
        document.body.removeChild(backgroundDiv);
    }
}
exports.removeLoaderBackground = removeLoaderBackground;
function isCrawler() {
    var ua = window.navigator.userAgent;
    var crawlers = ['facebookexternalhit/1.1'];
    // Crawler UA may have more text in them, so if any part of the UA matches a known crawler, then assume it is a crawler
    return some_1.default(crawlers, function (crawlerUA) { return ua.indexOf(crawlerUA) > -1; });
}
exports.isCrawler = isCrawler;
function setLoginHandler(lock, environment) {
    lock.on('authenticated', function (authResult) {
        trackLoginEvent();
        var loginsCount = authResult && authResult.idTokenPayload.loginsCount;
        if (loginsCount === 1) {
            sessionStorage.setItem('firstTimeLogin', 'true');
        }
        var user = buildUserFromAuthPayload(authResult && authResult.idTokenPayload);
        displayLoggedInUX(user.email);
        setPMNAndViafouraCookies(user);
        callSubscriptionAPI(user, environment).then(function (u) {
            if (u.state === 'Subscribed') {
                displaySubscribedUX(u.email, u.biller, environment);
            }
            if (document.URL.indexOf('/checkout') !== -1) {
                var url = getManageMyAccountUrl(user.biller, environment);
                window.location.href = url;
            }
            else {
                refreshPage();
            }
        });
    });
}
exports.setLoginHandler = setLoginHandler;
//# sourceMappingURL=LoginHelpers.js.map