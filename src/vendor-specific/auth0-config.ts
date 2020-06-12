declare const window;

const authOptions = {
  configurationBaseUrl: 'https://cdn.auth0.com',
  auth: {
    sso: true,
    redirect: false,
    redirectUrl: typeof window !== 'undefined' ? window.location.origin : '',
    responseType: 'token',
    params: {
      scope: 'openid email profile'
    }
  },
  theme: {
    logo: `//media.inquirer.com/designimages/PMNbrand_Lockup.png`,
    primaryColor: '#cc0000'
  },
  autofocus: true,
  autoclose: true,
  allowSignUp: true,
  initialScreen: 'login',
  allowShowPassword: true,
  languageDictionary: {
    success: {
      forgotPassword: 'We\'ve just sent you an email to reset your password.<br><a href="https://www.inquirer.com/activate">Didn\'t receive an email? Click here to check if your email address is registered with your account</a>'
    },
    error: {
      login: {
        "lock.invalid_email_password": '<span style="text-transform: none; font-size: 13px;">Wrong email or password.<div style="margin-top: 5px;">Do you have a print subscription?</div><div style="margin: -4px 0 2px;"><a href="https://www.inquirer.com/activate" style="text-decoration: underline; color: white;">Click here to register your email</a></div></span>'
      }
    }
  }
};

// Auth0 setLock function, used for triggering the login/logout modal
export function setLock(clientId, rootDomain) {
  return new window.Auth0Lock(
    clientId,
    rootDomain,
    authOptions);
}
