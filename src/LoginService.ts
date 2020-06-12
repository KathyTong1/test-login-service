declare const window, document;

import { getEndpoint } from './HttpService';
import {
  setLoginHandler,
  getDecryptedUser,
  clearUser,
  fetchUserProfile,
  addUserToDataLayer,
  callSubscriptionAPI,
  updateUserName,
  displaySubscribedUX,
  displayLoggedInUX,
  displayLoggedOutUX,
  initializePiano,
  showLoaderBackground,
  removeLoaderBackground,
  backupAndRestoreCookiesFromLocalStorage,
  isCrawler
  } from './LoginHelpers';

import { setLock } from './vendor-specific/auth0-config';

export class LoginService {
  public environment: string;
  public auth0Config: { clientId: string; rootDomain: string };
  public user: any;
  public lock: any;

  constructor(config: { env: string; auth0Config: { clientId: string; rootDomain: string } }) {
    // Dependent on PB, set in runtime properties
    this.environment = config.env;
    this.auth0Config = config.auth0Config;
    this.user = getDecryptedUser();
    this.lock = {};

    this.initialize = this.initialize.bind(this);
    this.loadUserInfoForMyProfile = this.loadUserInfoForMyProfile.bind(this);
    this.callToUpdateAPI = this.callToUpdateAPI.bind(this);
    this.onLoginClick = this.onLoginClick.bind(this);
    this.onLogoutClick = this.onLogoutClick.bind(this);
  }

  initializeLock() {
    this.lock = setLock(this.auth0Config.clientId, this.auth0Config.rootDomain);
    setLoginHandler(this.lock, this.environment);
  }

  loadLock(cb, isLogin) {
    // Lock already loaded
    if (this.lock.id) {
      cb();
    // Script already loaded
    } else if (window.Auth0Lock) {
      this.initializeLock();
      cb();
    // Script already added, but not yet downloaded (double-click scenario)
    } else if (document.getElementById('auth0-lock-script')) {
      // Ignore the second click
    } else {
      if (isLogin) {
        showLoaderBackground();
      }
      const lockScript = document.createElement('script');
      lockScript.src = '//cdn.auth0.com/js/lock/11.0.1/lock.min.js';
      lockScript.id = 'auth0-lock-script';
      lockScript.onload = () => {
        this.initializeLock();
        cb();
      };
      document.head.appendChild(lockScript);
    }
  }

  resendConfirmationEmail () {
    let url;
    if (this.environment === 'dev' || this.environment === 'stage') {
      url = 'https://dev.api.inquirer.com/v1/auth/resendVerify?auth0Id=' + this.user.auth0Id;
    } else {
      url = 'https://api.inquirer.com/v1/auth/resendVerify?auth0Id=' + this.user.auth0Id;
    }
    return getEndpoint({ url });
  }

  onLoginClick() {
    this.loadLock(() => {
      this.lock.show();
      this.lock.on('hide', removeLoaderBackground);
    }, true);
  }

  onLogoutClick() {
    clearUser();
    displayLoggedOutUX();
    this.loadLock(() => {
      this.lock.logout({ returnTo: 'https://www.inquirer.com' });
    }, false);
  }

  setClickHandlers() {
    const loginBtns = [...document.querySelectorAll('.auth0-log-in')];
    loginBtns.forEach(btn => btn.addEventListener('click', () => this.onLoginClick()));

    const logoutBtns = [...document.querySelectorAll('.logout-btn')];
    console.log('you got it', logoutBtns);
    logoutBtns.forEach(btn => btn.addEventListener('click', () => this.onLogoutClick()));
  }

  callToUpdateAPI(newUsername, onSucceed, onFailed) {
    const data = {
      username: newUsername,
      username_confirm: newUsername
    };
    updateUserName(this.environment, data, (data) => onSucceed(data), onFailed);
  }

  loadUserInfoForMyProfile(callback, onError) {
    if (!this.user.email || !this.user.displayName) { // If there is no user email and display name then call fetch
      fetchUserProfile(this.user.auth0Id, this.environment, callback, onError);
    } else {
      const data = {
        user: {
          user_metadata: {
            displayName: this.user.displayName
          },
          email: this.user.email
        }
      };
      callback(data);
    }
  }

  initialize() {
    backupAndRestoreCookiesFromLocalStorage();
    this.user = getDecryptedUser();
    this.setClickHandlers();

    const isCheckoutPage = window.location.pathname.includes('/checkout/');

    if (window.pmnAdmin && window.pmnAdmin.disableAuth) {
      if (isCheckoutPage) {
        initializePiano(this.user);
      }
      return;
    }

    addUserToDataLayer(this.user);
    // Check for the situation where a logged in user is missing the vCookie cookie and set it.
    // TODO: Do we really need to call this every time?
    fetchUserProfile(this.user.auth0Id, this.environment);

    switch (this.user.state) {
      case 'Subscribed':
        displaySubscribedUX(this.user.email, this.user.biller, this.environment);
        if (isCheckoutPage) {
          initializePiano(this.user);
        }
        // This is where we already know the user is an active subscriber and logged in before
        // Will only need to check their subscription status 24hr later last access
        const now = new Date().getTime();
        const timestamp = new Date(this.user.timestamp).getTime();
        const timeDiff = now - timestamp;
        // Session > 5min (300,000ms)
        // 24 hours = 8.64e+7 = 86,400,000
        if (timeDiff >= 86400000) {
          callSubscriptionAPI(this.user, this.environment);
        }
        break;
      case 'Logged In':
        displayLoggedInUX(this.user.email);
        // Check if Logged In user has recently subscribed
        callSubscriptionAPI(this.user, this.environment).then(function(u) {
          if (u.state === 'Subscribed') {
            displaySubscribedUX(u.email, u.biller, this.environment);
            if (isCheckoutPage) {
              initializePiano(u);
            }
          } else {
            initializePiano(u);
          }
        });
        break;
      default:
        if (!isCrawler()) {
          initializePiano(this.user);
        }
        break;
    }
  }
}
