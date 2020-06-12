declare const window, document;

import CryptoJS from 'crypto-js';
import some from 'lodash/some';
import { userServiceConfigs } from './vendor-specific/user-service-configs';
import { getEndpoint } from './HttpService';
import { setCookie, clearCookie, readCookie } from './CookieHelpers';

/**
 * Encrypts a user using CryptoJS -- essentially it turns a user into a long string that can be read and turned into a user object.
 *
 * @param {Object} data User object we are encrypting into a cookie.
 */
export function encryptData (data) {
  const salt = 'PMN_p3pp3r-#215';

  if (data === undefined || data === null) {
    throw new Error('Cannot encrypt empty data set');
  }

  // Hold data after determining typeof
  let dataHolder;

  // Object must be encapsulated w.in an Array
  if (typeof data === 'object') {
    dataHolder = JSON.stringify([data]);
  } else {
    dataHolder = data;
  }

  const cipherData = CryptoJS.AES.encrypt(dataHolder, salt);

  return encodeURIComponent(cipherData);
}

/**
 *  Standard nullUser, used in a few places, so has been placed into a const.
 */
export const nullUser = {
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
export function getDecryptedUser () {
  // Use this function get the user at any state of your Connext adventure
  const salt = 'PMN_p3pp3r-#215';
  const cookieData = readCookie('pmn-cookie');

  if (cookieData && cookieData.length > 0) {
    const data = decodeURIComponent(cookieData);
    const decryptedBytes = CryptoJS.AES.decrypt(data, salt);
    const user = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
    return user[0];
  } else {
    return nullUser;
  }
}

/**
 * Set cookies for Vf and PMN. pmn-cookie used by Connext, vCookie used by Vf.
 * setTimeout is there to ensure viafoura is ready, and is effectively a hack around slowness
 * from Connext. It is at parity with current Philly setup.
 *
 * @param {Object} user standard user object
 * @param {Integer} timeout milliseconds for timeout, 0 by default
 */
export function setPMNAndViafouraCookies(user, timeout = 0) {
  const cipherPMNUser = encryptData(user);
  const { displayName, email, uid } = user;
  const cipherVfUser = encryptData({ displayName, email, uid });
  setCookie('pmn-cookie', cipherPMNUser);
  setCookie('vCookie', cipherVfUser);

  if (window.vf && window.vf.length !== 0 && window.vf.session) {
    setTimeout(function() { window.vf.session.login.cookie(readCookie('vCookie')); }, timeout);
  }
}

/**
 * Updates several user state cookies on the page with key/value pairs.
 *
 * @param {Object} data key/value pairs
 */
function updateUserByKeys(data: any = {}) {
  const legacyUser = getDecryptedUser();
  Object.keys(data).forEach(key => {
    const item = data[key];
    legacyUser[item[0]] = item[1];
  });
  legacyUser['displayName'] = data.user.user_metadata.displayName;
  setPMNAndViafouraCookies(legacyUser, 2000);
}

/**
 *  Happens when user logs out. Clears the cookies, which is Part 1 of logging a user out.
 */
export function clearUser () {
  const cookiesToClear = ['pmn-cookie', 'vCookie'];

  cookiesToClear.forEach(function(key) {
    clearCookie(key);
    // Accessing localStorage will fail on old browsers
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.log('Local storage not accessible', e);
    }
  });

  if (window.vf && window.vf.session) {
    window.vf.session.logout();
  }
}

export function backupAndRestoreCookiesFromLocalStorage() {
  const cookiesToPersist = ['pmn-cookie', 'vCookie', '__tbc', '_ga'];
  let auth0Id;
  // Accessing localStorage will fail on old browsers and Safari in Private Browsing mode
  try {
    cookiesToPersist.forEach(function(key) {
      const cookieValue = readCookie(key);
      if (cookieValue) {
        localStorage.setItem(key, cookieValue);
      } else {
        const localStorageValue = localStorage.getItem(key);
        if (localStorageValue) {
          setCookie(key, localStorageValue);
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
  } catch (e) {
    console.log('Local storage not accessible', e);
  }
}


/**
 * If a user is logged in, we need to ensure they are in the PMNdataLayer[0].analytics object, so they are counted in the pageView event.
 * Add a masterId to the user object, per analytics requirements.
 */
export function addUserToDataLayer (user) {
  if (user.state && !window.pmnAdmin.disableAnalytics) {
    const masterId = user.auth0Id ? user.auth0Id.split('auth0|')[1] : null;
    user.masterId = masterId;
    window.PMNdataLayer = window.PMNdataLayer || [];
    window.PMNdataLayer[0] = window.PMNdataLayer[0] || { analytics: {} };
    window.PMNdataLayer[0].analytics.user = user;
  }
}

/**
 * Connext (also known as MG2) function that attempts to create a user object from local storage using Connext functions.
 * Largely untouched from Philly's current implementation.
 */
function buildUserFromAuthPayload(auth0Profile) {
  const user: any = {
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
export function fetchUserProfile (auth0Id = null, environment = 'prod', callback?: Function, onError?: Function) {
  if (auth0Id) {
    const url = `https://${userServiceConfigs[environment]}/${encodeURI(auth0Id)}`;
    getEndpoint({ url })
      .then(data => {
        updateUserByKeys(data);
        if (callback) {
          callback(data);
        }
      });
  } else {
    if (onError) {
      onError(true);
    }
  }
}

export function updateUserName (environment = 'prod', data, callback?: Function, onError?: Function) {
  const user = getDecryptedUser();
  const url = `https://${userServiceConfigs[environment]}/${encodeURI(user.auth0Id)}/username`;

  if (user && user.auth0Id) {
    getEndpoint({ url, data, query: '', method: 'POST' })
      .then(data => {
        updateUserByKeys(data);
        if (callback) {
          callback(data);
        }
      }).catch(() => {
        if (onError) {
          onError(true);
        }
      });
  }
}

export function isEmpty (val) {
  if ((val === undefined || val == null || val.length <= 0)) {
    return true;
  } else {
    return false;
  }
}

function displaySubscribedFooter(auth0Id) {
  const inquirerImages = [...document.querySelectorAll('.inquirer-img-link')];
  const dailyImages = [...document.querySelectorAll('.daily-img-link')];
  const inquirerEditions = [...document.querySelectorAll('.inquirer-digital-edition')];
  const dailyIEditions = [...document.querySelectorAll('.daily-digital-edition')];
  const inquirerSubs = [...document.querySelectorAll('.inquirer-subscribe')];
  const dailySubs = [...document.querySelectorAll('.daily-subscribe')];
  const inquirerServices = [...document.querySelectorAll('.inquirer-subscriber-services')];
  const dailyServices = [...document.querySelectorAll('.daily-subscriber-services')];
  const inquirerHref = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(auth0Id);
  const dailyHref = 'https://api.inquirer.com/v1/replica/replica?edition=DailyNews&mid=' + encodeURIComponent(auth0Id);

  inquirerImages.forEach(image => {
    image.href = inquirerHref;
    image.id = '';
  });
  dailyImages.forEach(image => {
    image.href = dailyHref;
    image.id = '';
  });
  inquirerEditions.forEach(btn => {
    btn.classList.remove('hidden');
    btn.href = inquirerHref;
  });
  dailyIEditions.forEach(btn => {
    btn.classList.remove('hidden');
    btn.href = dailyHref;
  });
  inquirerSubs.forEach(btn => btn.classList.add('hidden'));
  dailySubs.forEach(btn => btn.classList.add('hidden'));
  inquirerServices.forEach(btn => btn.classList.remove('hidden'));
  dailyServices.forEach(btn => btn.classList.remove('hidden'));
}

function getManageMyAccountUrl(biller, environment) {
  let url = '';
  if (biller === 'MG2') {
    if (environment === 'prod') {
      url = "https://myaccount.inquirer.com/";
    } else {
      url = "https://test-myaccount.inquirer.com/";
    }
  } else {
    if (environment === 'prod') {
      url = "https://account.inquirer.com/";
    } else {
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
export function displaySubscribedUX (btnText = 'My account', biller, environment) {
  const userDropdowns = [...document.querySelectorAll('.my-account-btn')];
  const manageAccountLinks = [...document.querySelectorAll('.manage-account-btn a')];
  const subscribeBtns = [...document.querySelectorAll('.subscribe-btn')];
  const subscribeWidgets = [...document.querySelectorAll('.subscribe-widget')];
  const loginBtns = [...document.querySelectorAll('.auth0-log-in')];
  const todayBtn = document.getElementById('todayspaper');

  const user = getDecryptedUser();
  
  if (todayBtn) {
    todayBtn.href = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(user.auth0Id);
    todayBtn.id = '';
  }

  subscribeBtns.forEach(btn => btn.classList.add('hidden'));
  subscribeWidgets.forEach(widget => widget.classList.add('hidden'));
  loginBtns.forEach(btn => btn.classList.add('hidden'));
  userDropdowns.forEach(btn => {
    btn.innerText = btnText;
    btn.classList.remove('hidden');
  });

  const url = getManageMyAccountUrl(biller, environment);
  manageAccountLinks.forEach(btn => btn.setAttribute("href", url));

  displaySubscribedFooter(user.auth0Id);
}

/**
 * Fires after user is logged in. Very similar to Subscribed, but subscribed btn not hidden.
 * TODO I bet these functions can be condensed into one.
 *
 * @param {String} btnText Usually replaced with user email (that's what appears on the button).
 */
export function displayLoggedInUX(btnText = 'My account') {
  const userDropdowns = [...document.querySelectorAll('.my-account-btn')];
  const loginBtns = [...document.querySelectorAll('.auth0-log-in')];
  const manageAccountbtns = [...document.querySelectorAll('.manage-account-btn')];

  loginBtns.forEach(btn => btn.classList.add('hidden'));

  userDropdowns.forEach(btn => {
    btn.innerText = btnText;
    btn.classList.remove('hidden');
  });

  manageAccountbtns.forEach(btn => btn.classList.add('hidden'));

  // Hidden Newsletter Sign Up
  if (document.querySelector('div.global-newsletter-sign-up.only-mobile')) {
    document.querySelector('div.global-newsletter-sign-up.only-mobile').classList.add('hidden');
  }

  // Hidden Miss a Story
  if (document.querySelector('div.subscribe-widget.only-mobile')) {
    document.querySelector('div.subscribe-widget.only-mobile').classList.add('hidden');
  }
}

// TODO: make sure this doesn't fire on user update or anything like that
function refreshPage() {
  const user = getDecryptedUser();

  if (user.state === 'Subscribed' || user.state === 'Logged In') {
    if (window.isReplicaLogin && user.state === 'Subscribed') {
      // Redirect to replica page with 'replica-login' event
      if (!window.isDaily) {
        window.location.href = 'https://api.inquirer.com/v1/replica/replica?mid=' + encodeURIComponent(user.auth0Id);
      } else {
        window.location.href = 'https://api.inquirer.com/v1/replica/replica?edition=DailyNews&mid=' + encodeURIComponent(user.auth0Id);
      }
    } else if (document.URL.indexOf('#loaded') === -1) {
      // Only reload the page if a user was unathorized, so they get the ad lite experience
      if (document.URL.substr(document.URL.length - 2) === '/#') {
        location.href += 'loaded';
      } else {
        location.href += '#loaded';
      }
      location.reload(true);
    }
  }
}

/**
 * Fires after user is logged out. Needed because the dropdown sticks in cache.
 */
export function displayLoggedOutUX() {
  const logoutBtns = [...document.querySelectorAll('.my-account-btn')];
  const loginBtns = [...document.querySelectorAll('.auth0-log-in')];
  const subscribeBtns = [...document.querySelectorAll('.subscribe-btn')];

  logoutBtns.forEach(btn => btn.classList.add('hidden'));
  loginBtns.forEach(btn => btn.classList.remove('hidden'));
  subscribeBtns.forEach(btn => btn.classList.remove('hidden'));

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

/**
 * Update User Cookie
 * @param {Object} user
 * @returns {Object}
 */
function updateUserByData (user, data) {
  user.timestamp = new Date();
  if (data) {
    if (data.isSubscriber) {
      user.state = 'Subscribed';
    } else {
      user.state = 'Logged In';
    }
    user.isVerified = data.isVerified;
    user.biller = data.biller;
    setCookie('pmn-cookie', encryptData(user));
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
export function callSubscriptionAPI (user, environment) {
  let url = '';
  if (environment === 'dev' || environment === 'stage') {
    url = 'https://dev.api.inquirer.com/v1/auth/subscriber';
  } else {
    url = 'https://api.inquirer.com/v1/auth/subscriber';
  }

  return getEndpoint({
    url: url,
    query: {
      auth0Id: user.auth0Id
    }
  }).then(function(data: any) {
    return updateUserByData(user, data);
  }, function() {
    return updateUserByData(user, false);
  });
}

export function initializePiano(user) {
  const channel = window.PMNdataLayer[0].analytics.primarysegment || '';
  window.tp = window.tp || [];
  window.tp.push(['setCustomVariable', 'channel', channel]);
  window.tp.push(['setCustomVariable', 'userState', user.state]);
  window.tp.push(['setCustomVariable', 'isVerified', user.isVerified]);
  window.tp.push(['setTags', [user.state]]);
  window.tp.push(['init', function () {
    window.tp.experience.init();
  }]);
}

function trackLoginEvent() {
  if (window.PMNdataLayer) {
    window.PMNdataLayer.push({
      'event': 'user-login',
      'loginStatus': 'log-in'
    });
  }
}

// TODO: Fire this when Piano shows the paywall
export const onPaywallShown = () => {
  const elements = document.querySelectorAll('.pb-f-article-comments');
  for (let i = 0; i < elements.length; i++) {
    elements[i].classList.add('hidden');
    elements[i].remove();
  }
};

export function showLoaderBackground() {
  const backgroundDiv = document.createElement('div');
  backgroundDiv.id = 'lock-loader-background';
  document.body.appendChild(backgroundDiv);
  setTimeout(() => {
    backgroundDiv.style.opacity = 0.5;
  }, 0);

  const spinner = document.createElement('spinner');
  spinner.setAttribute('class', 'spinner');
  setTimeout(() => backgroundDiv.appendChild(spinner), 300);
}

export function removeLoaderBackground() {
  const backgroundDiv = document.getElementById('lock-loader-background');
  if (backgroundDiv) {
    document.body.removeChild(backgroundDiv);
  }
}

export function isCrawler() {
  const ua = window.navigator.userAgent;
  const crawlers = ['facebookexternalhit/1.1'];
  // Crawler UA may have more text in them, so if any part of the UA matches a known crawler, then assume it is a crawler
  return some(crawlers, crawlerUA => ua.indexOf(crawlerUA) > -1);
}

export function setLoginHandler(lock, environment) {
  lock.on('authenticated', function(authResult) {
    trackLoginEvent();
    const loginsCount = authResult && authResult.idTokenPayload.loginsCount;
    if (loginsCount === 1) {
      sessionStorage.setItem('firstTimeLogin', 'true');
    }
    const user = buildUserFromAuthPayload(authResult && authResult.idTokenPayload);
    displayLoggedInUX(user.email);
    setPMNAndViafouraCookies(user);
    callSubscriptionAPI(user, environment).then(function(u) {
      if (u.state === 'Subscribed') {
        displaySubscribedUX(u.email, u.biller, environment);
      }
      if (document.URL.indexOf('/checkout') !== -1) {
        const url = getManageMyAccountUrl(user.biller, environment);
        window.location.href = url;
      } else {
        refreshPage();
      }
    });
  });
}
