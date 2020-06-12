export declare class LoginService {
    environment: string;
    auth0Config: {
        clientId: string;
        rootDomain: string;
    };
    user: any;
    lock: any;
    constructor(config: {
        env: string;
        auth0Config: {
            clientId: string;
            rootDomain: string;
        };
    });
    initializeLock(): void;
    loadLock(cb: any, isLogin: any): void;
    resendConfirmationEmail(): Promise<unknown>;
    onLoginClick(): void;
    onLogoutClick(): void;
    setClickHandlers(): void;
    callToUpdateAPI(newUsername: any, onSucceed: any, onFailed: any): void;
    loadUserInfoForMyProfile(callback: any, onError: any): void;
    initialize(): void;
}
