import { LoginService } from './';

describe('LoginService', () => {
  test('can create an instance', () => {
    const auth0Config = { clientId: 'WNSui5Uiq7JrIVDzJ75LPTCx9nV4T0rk', rootDomain: 'login.inquirer.com' };
    const loginServiceInstance = new LoginService({ env: 'prod', auth0Config });
    expect(loginServiceInstance).toBeDefined();
  });
});
