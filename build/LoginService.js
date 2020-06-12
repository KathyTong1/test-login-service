"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var HttpService_1 = require("./HttpService");
var LoginHelpers_1 = require("./LoginHelpers");
var auth0_config_1 = require("./vendor-specific/auth0-config");
var LoginService = /** @class */ (function () {
    function LoginService(config) {
        // Dependent on PB, set in runtime properties
        this.environment = config.env;
        this.auth0Config = config.auth0Config;
        this.user = LoginHelpers_1.getDecryptedUser();
        this.lock = {};
        this.initialize = this.initialize.bind(this);
        this.loadUserInfoForMyProfile = this.loadUserInfoForMyProfile.bind(this);
        this.callToUpdateAPI = this.callToUpdateAPI.bind(this);
        this.onLoginClick = this.onLoginClick.bind(this);
        this.onLogoutClick = this.onLogoutClick.bind(this);
    }
    LoginService.prototype.initializeLock = function () {
        this.lock = auth0_config_1.setLock(this.auth0Config.clientId, this.auth0Config.rootDomain);
        LoginHelpers_1.setLoginHandler(this.lock, this.environment);
    };
    LoginService.prototype.loadLock = function (cb, isLogin) {
        var _this = this;
        // Lock already loaded
        if (this.lock.id) {
            cb();
            // Script already loaded
        }
        else if (window.Auth0Lock) {
            this.initializeLock();
            cb();
            // Script already added, but not yet downloaded (double-click scenario)
        }
        else if (document.getElementById('auth0-lock-script')) {
            // Ignore the second click
        }
        else {
            if (isLogin) {
                LoginHelpers_1.showLoaderBackground();
            }
            var lockScript = document.createElement('script');
            lockScript.src = '//cdn.auth0.com/js/lock/11.0.1/lock.min.js';
            lockScript.id = 'auth0-lock-script';
            lockScript.onload = function () {
                _this.initializeLock();
                cb();
            };
            document.head.appendChild(lockScript);
        }
    };
    LoginService.prototype.resendConfirmationEmail = function () {
        var url;
        if (this.environment === 'dev' || this.environment === 'stage') {
            url = 'https://dev.api.inquirer.com/v1/auth/resendVerify?auth0Id=' + this.user.auth0Id;
        }
        else {
            url = 'https://api.inquirer.com/v1/auth/resendVerify?auth0Id=' + this.user.auth0Id;
        }
        return HttpService_1.getEndpoint({ url: url });
    };
    LoginService.prototype.onLoginClick = function () {
        var _this = this;
        this.loadLock(function () {
            _this.lock.show();
            _this.lock.on('hide', LoginHelpers_1.removeLoaderBackground);
        }, true);
    };
    LoginService.prototype.onLogoutClick = function () {
        var _this = this;
        LoginHelpers_1.clearUser();
        LoginHelpers_1.displayLoggedOutUX();
        this.loadLock(function () {
            _this.lock.logout({ returnTo: 'https://www.inquirer.com' });
        }, false);
    };
    LoginService.prototype.setClickHandlers = function () {
        var _this = this;
        var loginBtns = __spreadArrays(document.querySelectorAll('.auth0-log-in'));
        loginBtns.forEach(function (btn) { return btn.addEventListener('click', function () { return _this.onLoginClick(); }); });
        var logoutBtns = __spreadArrays(document.querySelectorAll('.logout-btn'));
        logoutBtns.forEach(function (btn) { return btn.addEventListener('click', function () { return _this.onLogoutClick(); }); });
    };
    LoginService.prototype.callToUpdateAPI = function (newUsername, onSucceed, onFailed) {
        var data = {
            username: newUsername,
            username_confirm: newUsername
        };
        LoginHelpers_1.updateUserName(this.environment, data, function (data) { return onSucceed(data); }, onFailed);
    };
    LoginService.prototype.loadUserInfoForMyProfile = function (callback, onError) {
        if (!this.user.email || !this.user.displayName) { // If there is no user email and display name then call fetch
            LoginHelpers_1.fetchUserProfile(this.user.auth0Id, this.environment, callback, onError);
        }
        else {
            var data = {
                user: {
                    user_metadata: {
                        displayName: this.user.displayName
                    },
                    email: this.user.email
                }
            };
            callback(data);
        }
    };
    LoginService.prototype.initialize = function () {
        LoginHelpers_1.backupAndRestoreCookiesFromLocalStorage();
        this.user = LoginHelpers_1.getDecryptedUser();
        this.setClickHandlers();
        var isCheckoutPage = window.location.pathname.includes('/checkout/');
        if (window.pmnAdmin && window.pmnAdmin.disableAuth) {
            if (isCheckoutPage) {
                LoginHelpers_1.initializePiano(this.user);
            }
            return;
        }
        LoginHelpers_1.addUserToDataLayer(this.user);
        // Check for the situation where a logged in user is missing the vCookie cookie and set it.
        // TODO: Do we really need to call this every time?
        LoginHelpers_1.fetchUserProfile(this.user.auth0Id, this.environment);
        switch (this.user.state) {
            case 'Subscribed':
                LoginHelpers_1.displaySubscribedUX(this.user.email, this.user.biller, this.environment);
                if (isCheckoutPage) {
                    LoginHelpers_1.initializePiano(this.user);
                }
                // This is where we already know the user is an active subscriber and logged in before
                // Will only need to check their subscription status 24hr later last access
                var now = new Date().getTime();
                var timestamp = new Date(this.user.timestamp).getTime();
                var timeDiff = now - timestamp;
                // Session > 5min (300,000ms)
                // 24 hours = 8.64e+7 = 86,400,000
                if (timeDiff >= 86400000) {
                    LoginHelpers_1.callSubscriptionAPI(this.user, this.environment);
                }
                break;
            case 'Logged In':
                LoginHelpers_1.displayLoggedInUX(this.user.email);
                // Check if Logged In user has recently subscribed
                LoginHelpers_1.callSubscriptionAPI(this.user, this.environment).then(function (u) {
                    if (u.state === 'Subscribed') {
                        LoginHelpers_1.displaySubscribedUX(u.email, u.biller, this.environment);
                        if (isCheckoutPage) {
                            LoginHelpers_1.initializePiano(u);
                        }
                    }
                    else {
                        LoginHelpers_1.initializePiano(u);
                    }
                });
                break;
            default:
                if (!LoginHelpers_1.isCrawler()) {
                    LoginHelpers_1.initializePiano(this.user);
                }
                break;
        }
    };
    return LoginService;
}());
exports.LoginService = LoginService;
//# sourceMappingURL=LoginService.js.map