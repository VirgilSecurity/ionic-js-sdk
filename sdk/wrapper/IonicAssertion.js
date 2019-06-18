import { ERRCODE, ERRMSG } from '../constants';

export { getIonicAssertion };

/**
 * Sends the `argObj.samlAssertionXml` to the `argObj.enrollmentUrl` to get the Ionic Assertion.
 * @param {Object} argObj
 * @param {string} argObj.enrollmentUrl - Enrollment URL.
 * @param {string} argObj.samlAssertionXml - SAML Assertion.
 * @returns {Promise<IonicAssertion>} - A promise that the profile for that user is loaded.
 * @example
 * var promise = getIonicAssertion({
 *   enrollmentUrl: 'https://enrollment.ionic.com/keyspace/MYKEYSPACE/sp/737126836123871263868126/headless/saml',
 *   samlAssertionXml: '<?xml version="1.0"?><samlp:Response>...</samlp:Response>'
 * });
 * @h
 * @instance
 */
function getIonicAssertion(argObj) {
    return fetch(argObj.enrollmentUrl, {
        mode: 'cors',
        method: 'POST',
        headers: {
            'expect': '100-continue', 
        },
        // eslint-disable-next-line lowercase-naming/lowercase-naming
        body: new URLSearchParams({ SAMLResponse: argObj.samlAssertionXml })
    }).then(enrollmentResponse => {
        if (!enrollmentResponse.ok) {
            return Promise.reject({
                sdkResponseCode: ERRCODE.UNKNOWN,
                error: `Enrollment server responded with the status ${enrollmentResponse.status}.`
            });
        }
        const ionicAssertion = {
            'X-Ionic-Reg-Uidauth': enrollmentResponse.headers.get('X-Ionic-Reg-Uidauth'),
            'X-Ionic-Reg-Stoken': enrollmentResponse.headers.get('X-Ionic-Reg-Stoken'),
            'X-Ionic-Reg-Ionic-API-Urls': enrollmentResponse.headers.get('X-Ionic-Reg-Ionic-API-Urls'),
            'X-Ionic-Reg-Enrollment-Tag': enrollmentResponse.headers.get('X-Ionic-Reg-Enrollment-Tag'),
            'X-Ionic-Reg-Pubkey': enrollmentResponse.headers.get('X-Ionic-Reg-Pubkey')
        };

        return {
          sdkResponseCode: 0,
          ionicAssertion: ionicAssertion
        };
    }).catch(err => {
        if (err.sdkResponseCode) {
          return Promise.reject(err);
        }
        
        const location = typeof self !== 'undefined' ? self.location : window.location;
        return Promise.reject({
            sdkResponseCode: ERRCODE.REQUEST_FAILED,
            error: `${
                ERRMSG.REQUEST_FAILED
            } ${
                err.message
            }. Make sure your Enrollment Server configuration allows requests from ${location.origin}.`, 
        });
    });
}

////////////////////////////////////////////
// JSDoc custom types
// see http://usejsdoc.org/tags-typedef.html
//
// Defines objects that are passed into or
// returned by multiple functions
////////////////////////////////////////////
/**
 * Values obtained from or specified by the Enrollment Server.
 * @typedef {Object.<string, string>} IonicAssertion
 * @param {String} ionicAssertion.X-Ionic-Reg-Stoken - A unique string that is returned directly by the Enrollment Portal to provide an extra factor of authentication.
 * @param {String} ionicAssertion.X-Ionic-Reg-Uidauth - A signed and optionally encrypted token value that contains information about the identity of the user.
 * @param {String} ionicAssertion.X-Ionic-Reg-Enrollment-Tag - The unique identifier of the set of keyservers into which the device is enrolling.
 * @param {String} ionicAssertion.X-Ionic-Reg-Pubkey - Typically an RSA 3072-bit key used for encrypting the enrollment package for the key server via an ephemeral intermediate key.
 * @param {String} ionicAssertion.X-Ionic-Reg-Ionic-API-Urls - The scheme, host, and optionally port of the Ionic.com API server that should be used by the device when enrolling.
 */